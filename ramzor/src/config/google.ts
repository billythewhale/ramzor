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
            window: 10,
            maxCalls: 5,
            description: '500 calls/min per IP',
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
