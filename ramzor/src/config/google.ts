import { makeKey, Zones } from '@tw/ramzor';

const config: Zones = [
  {
    key: makeKey('google_ads'),
    description: 'Google Ads API',
    limits: [
      {
        limitBy: ['data.accountId'],
        policies: [
          {
            window: 1,
            maxCalls: 1,
            description: '1 call/second per account',
          },
        ],
      },
      {
        // let's make some arbitrary property that we'll add to the request object
        // for example, if the API is rate limited by IP ( which we might not know )
        // we can add a property to the request object that will be used to identify
        // requests from this process
        limitBy: ['tw-ip'],
        policies: [
          {
            window: 30,
            maxCalls: 500,
            description: '500 calls/30sec per IP',
          },
        ],
      },
    ],
  },
];

export default config;
