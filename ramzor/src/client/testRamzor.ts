import urls from './urls';
import { throttleRequests } from './throttledTraffic';
import type { RequestConfig } from '../types';

const shops = Array.from(
  { length: 100 },
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

const importDataRequests: RequestConfig[] = shopDocs
  .map((shopData) => getTestRequests(shopData))
  .flat();

export async function runClient() {
  const results = await throttleRequests(importDataRequests.slice(0, 10));
  console.log(results);
}

function getTestRequests(shopData: any): RequestConfig[] {
  return [
    // ...getFacebookReqs(shopData),
    ...getGoogleReqs(shopData),
    // ...getKlaviyoReqs(shopData),
  ].map((req) => ({
    ...req,
    ip: process.env.HOST_IP || '',
  }));
}

function getFacebookReqs(shopData: any): RequestConfig[] {
  const url = urls.facebook;
  return [
    {
      path: '/analytics/endpoint1',
      apiName: 'ads-analytics',
      query: {
        accountId: shopData['facebook-ads'].accountId,
      },
      method: 'GET',
    },
    {
      path: '/analytics/endpoint2',
      apiName: 'ads-analytics',
      query: {
        accountId: shopData['facebook-ads'].accountId,
      },
      method: 'GET',
    },
    {
      path: '/manage/endpoint1',
      apiName: 'ads-management',
      body: {
        accountId: shopData['facebook-ads'].accountId,
      },
      method: 'POST',
    },
    {
      path: '/manage/endpoint2',
      apiName: 'ads-management',
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

function getGoogleReqs(shopData: any): RequestConfig[] {
  const url = urls.google;
  return [
    {
      path: '/endpoint1',
    },
    {
      path: '/endpoint2',
    },
  ].map((req) => ({
    ...req,
    provider: 'google-ads',
    url,
    query: {
      accountId: shopData['google-ads'].accountId,
    },
  }));
}

function getKlaviyoReqs(shopData: any): RequestConfig[] {
  const url = urls.klaviyo;
  return [
    {
      path: '/api/profiles',
    },
    {
      path: '/api/profiles',
      query: {
        'additional-fields': 'email,name,phone',
      },
    },
    {
      path: `/api/accounts/${shopData.klaviyo.accountId}/info`,
      params: {
        id: shopData.klaviyo.accountId,
      },
    },
    {
      path: `/api/accounts/${shopData.klaviyo.accountId}/info`,
      params: {
        id: shopData.klaviyo.accountId,
      },
      query: {
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
    console.error(err);
    process.exit(1);
  });
}
