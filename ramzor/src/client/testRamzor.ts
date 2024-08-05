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
import { getMetrics, useStoplight, type AxiosRequestConfig } from '@tw/ramzor';
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

async function sendRequest(r: any) {
  log(r);
  return await axios.request(makeAxiosReq(r) as any);
}

let done = false;
const _facebookSender = useStoplight('facebook', facebookConfig, {
  // debugName: 'facebook',
});
const _klaviyoSender = useStoplight('klaviyo', klaviyoConfig, {
  // debugName: 'klaviyo',
});
const _googleSender = useStoplight('google', googleConfig, {
  // debugName: 'google',
});
const googleSender = async (req: any) => {
  const ip = Math.random() < 0.5 ? '123.4.5.6' : '135.7.9.11'; // pretend we're sending from 2 different IPs
  const r = { ...req, 'tw-ip': ip };
  return _googleSender(r, async () => await sendRequest(r));
};

const klaviyoSender = async (req: any) => {
  return _klaviyoSender(req, async () => await sendRequest(req));
};

const facebookSender = async (req: any) => {
  return _facebookSender(req, async () => await sendRequest(req));
};

export async function runClient() {
  const start = process.hrtime.bigint();
  clearClientLog();
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
              new Promise((resolve) =>
                setTimeout(
                  () =>
                    resolve(
                      sender(r).catch((e) => {
                        console.log({
                          status: e.response?.status,
                          message: e.message,
                          request: r,
                        });
                      })
                    ),
                  Math.floor(Math.random() * 200)
                )
              )
          )
        );
      })
      .flat()
  );
  logProgress();
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

async function logProgress() {
  await new Promise((r) => setTimeout(r, 1000));
  console.log(getMetrics());
  if (!done) {
    logProgress();
  } else {
    process.exit(0);
  }
}

function getTestRequests(shopData: any): AxiosRequestConfig[][] {
  return [
    getFacebookReqs(shopData),
    getGoogleReqs(shopData),
    getKlaviyoReqs(shopData),
  ].map((provider) =>
    provider.map((req) => ({ ...req, body: { ...req.body, requestId: v4() } }))
  );
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
  runClient().catch((err) => {
    process.stdout.write('\n');
    console.error(err);
    process.exit(1);
  });
}
