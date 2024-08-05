import { v4 } from 'uuid';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = 'ImAWhale';

import axios from 'axios';
import { promises as fs } from 'fs';

import urls from './urls';
import facebookConfig from '../config/facebook';
import klaviyoConfig from '../config//klaviyo';
import googleConfig from '../config/google';

import { clearClientLog, log } from './log';
import {
  getMetrics,
  report429,
  useAbortableStoplight,
  useStoplightAxiosInstance,
  type AxiosRequestConfig,
} from '@tw/ramzor';
import { makeAxiosReq } from '../utils/makeAxiosReq';

const shops = Array.from(
  { length: 1000 },
  (_, i) => `shop${i + 1}.myshopify.com`
);

const shopDocs = shops.map((shop) => ({
  shopId: shop,
  klaviyo: {
    accountId: Math.random().toString(36).substring(2),
  },
  'facebook-ads': {
    accountId: Math.random().toString(36).substring(2),
  },
  'google-ads': {
    accountId: Math.random().toString(36).substring(2),
  },
}));

const [facebookReqs, googleReqs, klaviyoReqs] = shopDocs.reduce(
  (acc, shopData) => {
    const [fb, g, k] = getTestRequests(shopData);
    acc[0].push(...fb);
    acc[1].push(...g);
    acc[2].push(...k);
    return acc;
  },
  [[], [], []]
);

async function resetServers() {
  return Promise.all(
    Object.keys(urls).map(async (p) => {
      try {
        console.log('Reset ', p);
        await axios.post(urls[p] + '/reset');
      } catch (e) {
        console.error('failed to reset server', p, e.message);
      }
    })
  );
}

async function sendRequest(r: any) {
  log(r);
  try {
    return await axios.request(r);
  } catch (e) {
    if (e.code === 'ECONNRESET') {
      return await sendRequest(r);
    }
    console.error(e);
    process.exit(1);
  }
}

let done = false;
let progressInterval: any;

let tryToAbort = 0;
let abortedReceived = 0;
let resRecieved = 0;

export async function runClientWithAxiosInstance() {
  console.log('Reset servers');
  await resetServers();
  console.log('Clear client log');
  clearClientLog();
  const facebookClient = useStoplightAxiosInstance('facebook', facebookConfig);
  const googleClient = useStoplightAxiosInstance('google', googleConfig);
  const klaviyoClient = useStoplightAxiosInstance('klaviyo', klaviyoConfig);
  const start = process.hrtime.bigint();
  const promises = Promise.all(
    [
      [facebookReqs, facebookClient],
      [googleReqs, googleClient],
      [klaviyoReqs, klaviyoClient],
    ]
      .map(async ([requests, client]: [AxiosRequestConfig[], any]) => {
        return await Promise.all(
          requests.map(
            (r: any, i: number) =>
              new Promise((resolve, reject) =>
                setTimeout(
                  async () => {
                    try {
                      const response = await client.request(makeAxiosReq(r));
                      resRecieved++;
                      resolve(response.data);
                    } catch (e) {
                      reject(e);
                      console.log({
                        status: e.response?.status,
                        message: e.message,
                        request: r,
                      });
                    }
                  },
                  Math.floor(Math.random() * 200)
                )
              )
          )
        );
      })
      .flat()
  );
  progressInterval = setInterval(logProgress, 1000);
  const results = (await promises).flat();
  done = true;
  const end = process.hrtime.bigint();
  const diff = Number(end - start) / 1e6;
  const four20nines = results.filter((r: any) => r.status === 429).length;
  const fiveHundos = results.filter((r: any) => r.status >= 500).length;
  if (four20nines || fiveHundos) {
    console.error('some requests failed!', diff, 'ms', {
      four20nines,
      fiveHundos,
    });
  } else {
    console.log('all requests succeeded!', diff, 'ms');
  }
}

export async function runClientWithAbortable() {
  const _facebookSender = useAbortableStoplight('facebook', facebookConfig, {
    // debugName: 'facebook',
  });
  const _klaviyoSender = useAbortableStoplight('klaviyo', klaviyoConfig, {
    // debugName: 'klaviyo',
  });
  const _googleSender = useAbortableStoplight('google', googleConfig, {
    // debugName: 'google',
  });
  const googleSender = (req: any) => {
    const ip = Math.random() < 0.5 ? '123.4.5.6' : '135.7.9.11'; // pretend we're sending from 2 different IPs
    const r = makeAxiosReq({ ...req, 'tw-ip': ip });
    return _googleSender(r, async () => await sendRequest(r));
  };

  const klaviyoSender = (req: any) => {
    const r = makeAxiosReq(req);
    return _klaviyoSender(r, async () => await sendRequest(r));
  };

  const facebookSender = (req: any) => {
    const r = makeAxiosReq(req);
    return _facebookSender(r, async () => await sendRequest(r));
  };

  console.log('Reset servers');
  await resetServers();
  console.log('Clear client log');
  clearClientLog();
  const start = process.hrtime.bigint();
  const promises = Promise.all(
    [
      [facebookReqs, facebookSender],
      [googleReqs, googleSender],
      [klaviyoReqs, klaviyoSender],
    ]
      .map(async ([requests, sender]: [AxiosRequestConfig[], any]) => {
        return await Promise.all(
          requests.map(
            (r: any) =>
              new Promise((resolve, reject) =>
                setTimeout(
                  async () => {
                    const { abort, promise } = sender(r);
                    let timeout: any;
                    try {
                      timeout = setTimeout(
                        () => {
                          tryToAbort++;
                          abort();
                        },
                        Math.random() * 1000 * 60 * 5
                      );
                      const { aborted, result, error } = await promise;
                      clearTimeout(timeout);
                      if (aborted) {
                        abortedReceived++;
                        resolve('ok');
                        return;
                      }
                      if (error) {
                        reject(error);
                        return;
                      }
                      resRecieved++;
                      resolve(result);
                    } catch (e) {
                      if (!e.reponse) {
                        abort();
                      }
                      console.log({
                        status: e.response?.status,
                        message: e.message,
                        request: r,
                      });
                    }
                  },
                  Math.floor(Math.random() * 200)
                )
              )
          )
        );
      })
      .flat()
  );
  progressInterval = setInterval(logProgress, 1000);
  const results = (await promises).flat();
  done = true;
  const end = process.hrtime.bigint();
  const diff = Number(end - start) / 1e6;
  const four20nines = results.filter((r: any) => r.status === 429).length;
  const fiveHundos = results.filter((r: any) => r.status >= 500).length;
  if (four20nines || fiveHundos) {
    console.error('some requests failed!', diff, 'ms', {
      four20nines,
      fiveHundos,
    });
  } else {
    console.log('all requests succeeded!', diff, 'ms');
  }
}

function logProgress() {
  console.log({
    stoplight: { ...getMetrics() },
    local: { resRecieved, abortedReceived, tryToAbort },
  });
  if (done) {
    clearInterval(progressInterval);
  }
}

function getTestRequests(shopData: any): AxiosRequestConfig[][] {
  return [
    getFacebookReqs(shopData),
    getGoogleReqs(shopData),
    getKlaviyoReqs(shopData),
  ];
}

function getFacebookReqs(shopData: any): any[] {
  const url = urls.facebook;
  return [
    {
      path: '/analytics/endpoint1',
      apiName: 'ads_analytics',
      body: {
        accountId: shopData['facebook-ads'].accountId,
      },
      method: 'POST',
    },
    {
      path: '/analytics/endpoint2',
      apiName: 'ads_analytics',
      body: {
        accountId: shopData['facebook-ads'].accountId,
      },
      method: 'POST',
    },
    {
      path: '/analytics/endpoint1',
      apiName: 'ads_analytics',
      body: {
        accountId: shopData['facebook-ads'].accountId,
      },
      method: 'POST',
    },
    {
      path: '/analytics/endpoint2',
      apiName: 'ads_analytics',
      body: {
        accountId: shopData['facebook-ads'].accountId,
      },
      method: 'POST',
    },
    {
      path: '/manage/endpoint1',
      apiName: 'ads_management',
      body: {
        accountId: shopData['facebook-ads'].accountId,
      },
      method: 'POST',
    },
    {
      path: '/manage/endpoint2',
      apiName: 'ads_management',
      body: {
        accountId: shopData['facebook-ads'].accountId,
      },
      method: 'POST',
    },
    {
      path: '/manage/endpoint2',
      apiName: 'ads_management',
      body: {
        accountId: shopData['facebook-ads'].accountId,
      },
      method: 'POST',
    },
  ].map((req) => ({
    ...req,
    provider: 'facebook-ads',
    url,
  }));
}

function getGoogleReqs(shopData: any): any[] {
  const url = urls.google;
  return [
    {
      path: '/endpoint1',
    },
    {
      path: '/endpoint2',
    },
  ].map((req, i) => ({
    ...req,
    provider: 'google-ads',
    url,
    body: {
      accountId: shopData['google-ads'].accountId,
    },
  }));
}

function getKlaviyoReqs(shopData: any): any[] {
  const url = urls.klaviyo;
  return [
    {
      path: '/api/profiles',
      body: {
        'additional-fields': 'email,name,phone',
      },
    },
    {
      path: '/api/profiles',
    },
    {
      path: `/api/accounts/${shopData.klaviyo.accountId}/info`,
      body: {
        uuid: v4(),
      },
    },
    {
      path: `/api/accounts/${shopData.klaviyo.accountId}/info`,
      params: {
        id: shopData.klaviyo.accountId,
      },
      body: {
        'additional-fields': 'email,name,phone',
      },
    },
  ].map((req) => ({
    ...req,
    provider: 'klaviyo',
    url,
    headers: {
      'x-tw-klaviyo-account': shopData.klaviyo.accountId,
    },
  }));
}

if (require.main === module) {
  runClientWithAxiosInstance().catch((err) => {
    process.stdout.write('\n');
    console.error(err);
    process.exit(1);
  });
}
