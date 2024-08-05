import {
  makeKey,
  type AxiosRequestConfig,
  type Policy,
  type Zones,
} from '@tw/ramzor';

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
    window: 30,
    maxCalls: 60,
    description: '60 calls/30s per account',
  },
];

const limit_md: Policy[] = [
  {
    window: 1,
    maxCalls: 10,
    description: '10 calls/second per account',
  },
  {
    window: 30,
    maxCalls: 150,
    description: '150 calls/30s per account',
  },
];

const limit_lg: Policy[] = [
  {
    window: 1,
    maxCalls: 75,
    description: '75 calls/second per account',
  },
  {
    window: 30,
    maxCalls: 700,
    description: '700 calls/30s per account',
  },
];

const limit_xl: Policy[] = [
  {
    window: 1,
    maxCalls: 350,
    description: '350 calls/second per account',
  },
  {
    window: 30,
    maxCalls: 3500,
    description: '3500 calls/30s per account',
  },
];

const config: Zones = [
  {
    key: makeKey('additional_fields'),
    condition: (req: AxiosRequestConfig) =>
      req.params?.['additional-fields'] !== undefined ||
      req.data?.['additional-fields'] !== undefined,
    description: 'Klaviyo additional-fields query',
    limits: [
      {
        limitBy: ['headers.x-tw-klaviyo-account'],
        policies: [...limit_xs],
      },
    ],
  },
  {
    key: makeKey('profiles'),
    condition: (req: AxiosRequestConfig) =>
      req.method === 'GET' && req.url === '/api/profiles',
    description: 'Klaviyo GET /profiles',
    limits: [
      {
        limitBy: ['headers.x-tw-klaviyo-account'],
        policies: [...limit_sm],
      },
    ],
  },
  {
    key: makeKey('accounts_info'),
    condition: (req: AxiosRequestConfig) =>
      /\/accounts\/\w+\/info/.test(req.url),
    description: 'Klaviyo GET /accounts/:id/info',
    limits: [
      {
        limitBy: ['headers.x-tw-klaviyo-account'],
        policies: [...limit_sm],
      },
    ],
  },
  {
    key: makeKey('by_account'),
    limits: [
      {
        limitBy: ['headers.x-tw-klaviyo-account'],
        policies: [...limit_sm],
      },
    ],
  },
];

export default config;
