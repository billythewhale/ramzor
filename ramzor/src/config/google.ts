import { RateLimitsConfig, ZonesConfig } from '../types';

const zones: ZonesConfig = [
  {
    for: {
      provider: 'google-ads',
      description: 'Google Ads API',
    },
    limits: [
      {
        limitBy: ['query.accountId'],
        policies: [
          {
            window: 1,
            maxCalls: 1,
            description: '1 call/second per account',
          },
        ],
      },
      {
        limitBy: ['ip'],
        policies: [
          {
            window: 60,
            maxCalls: 50,
            description: '50 calls/min per IP',
          },
        ],
      },
    ],
  },
];

const config: RateLimitsConfig = {
  zones,
};

export default config;
