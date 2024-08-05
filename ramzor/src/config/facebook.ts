import { makeKey, Zones, Policy } from '@tw/ramzor';

const limit_sm: Policy = {
  window: 1,
  maxCalls: 1,
  description: '1 call/second',
};

const limit_md: Policy = {
  window: 1,
  maxCalls: 2,
  description: '2 calls/second',
};

const config: Zones = [
  {
    key: makeKey('facebook_ads_analytics'),
    condition: (req: any) => !!req.url?.includes('analytics'),
    description: 'Facebook Ads Analytics API',
    limits: [
      {
        limitBy: ['data.accountId', 'url'],
        policies: [limit_sm],
      },
    ],
  },
  {
    key: makeKey('ads_management'),
    condition: (req: any) => !!req.url?.includes('manage'),
    description: 'Facebook Ads Management API',
    limits: [
      {
        limitBy: ['data.accountId'],
        policies: [limit_md],
      },
    ],
  },
];

export default config;
