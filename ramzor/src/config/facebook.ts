import type {
  Limit,
  Policy,
  RateLimitsConfig,
  ZoneDescriber,
  ZonesConfig,
} from '../types';

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

const base: ZoneDescriber = {
  provider: 'facebook-ads',
  description: 'Facebook Ads API',
};

const zones: ZonesConfig = [
  {
    for: {
      ...base,
      apiName: 'ads_analytics',
      description: 'Facebook Ads Analytics API',
    },
    limits: [
      {
        limitBy: ['query.accountId', 'path'],
        policies: [limit_sm],
      },
    ],
  },
  {
    for: {
      ...base,
      apiName: 'ads_management',
      description: 'Facebook Ads Management API',
    },
    limits: [
      {
        limitBy: ['body.accountId'],
        policies: [limit_md],
      },
    ],
  },
];

const config: RateLimitsConfig = {
  zones,
};

export default config;
