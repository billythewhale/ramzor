import {
  Limit,
  Policy,
  RateLimitsConfig,
  ZoneDescriber,
  ZonesConfig,
} from '../types';

const limit_xs: Policy[] = [
  {
    window: 1,
    maxCalls: 1,
    description: '1 call/second per account',
  },
  {
    window: 10,
    maxCalls: 10,
    description: '10 calls/minute per account',
  },
];

const limit_sm: Policy[] = [
  {
    window: 1,
    maxCalls: 3,
    description: '3 calls/second per account',
  },
  {
    window: 60,
    maxCalls: 60,
    description: '60 calls/minute per account',
  },
];

const limit_md: Policy[] = [
  {
    window: 1,
    maxCalls: 10,
    description: '10 calls/second per account',
  },
  {
    window: 60,
    maxCalls: 150,
    description: '150 calls/minute per account',
  },
];

const limit_lg: Policy[] = [
  {
    window: 1,
    maxCalls: 75,
    description: '75 calls/second per account',
  },
  {
    window: 60,
    maxCalls: 700,
    description: '700 calls/minute per account',
  },
];

const limit_xl: Policy[] = [
  {
    window: 1,
    maxCalls: 350,
    description: '350 calls/second per account',
  },
  {
    window: 60,
    maxCalls: 3500,
    description: '3500 calls/minute per account',
  },
];

const base: ZoneDescriber = {
  provider: 'klaviyo',
  description: 'Klaviyo API',
};

const zones: ZonesConfig = [
  {
    for: {
      ...base,
      request: {
        query: {
          'additional-fields': { exists: true },
        },
      },
      description: 'Klaviyo additional-fields query',
    },
    limits: [
      {
        limitBy: ['headers.x-tw-klaviyo-account'],
        policies: [...limit_xs],
      },
    ],
  },
  {
    for: {
      ...base,
      request: {
        path: {
          exact: '/api/profiles',
        },
      },
      description: 'Klaviyo GET /profiles',
    },
    limits: [
      {
        limitBy: ['headers.x-tw-klaviyo-account'],
        policies: [...limit_sm],
      },
    ],
  },
  {
    for: {
      ...base,
      request: {
        path: {
          match: /\/accounts\/\w+\/info/,
        },
      },
      description: 'Klaviyo GET /accounts/:id/info',
    },
    limits: [
      {
        limitBy: ['headers.x-tw-klaviyo-account'],
        policies: [...limit_sm],
      },
    ],
  },
  {
    for: {
      ...base,
    },
    limits: [
      {
        limitBy: ['headers.x-tw-klaviyo-account'],
        policies: [...limit_sm],
      },
    ],
  },
];

const config: RateLimitsConfig = {
  zones,
};

export default config;
