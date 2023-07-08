# ramzor

Rate Limit stoplight

There are two parts:

-   server: keeps track of global use of rate limits and gives a red-light/green-light to client
-   client: asks server permission to make a request and follows client's instructions

The server and the client keep track of relevant rate limit using `zones`.

To illustrate the concept of a `zone`, imagine that provider `facebook` has two endpoints, `/get-campaigns` and `/get-orders` and each endpoint has a rate limit of 6 calls per second per facebook ads account.
Also imagine that there is a global limit of 10 calls/sec per account.

Imagine we want to call both of these endpoints on behalf of two accounts, `acct_a` and `acct_b`, for a total of 4 api calls.

Api call 1 would touch 2 **zones**: `facebook-ads::acct_a::10;w=1` and `facebook-ads:get-campaigns::acct_a::6;w=1`
Api call 2 would touch 2 **zones**: `facebook-ads::acct_a::10;w=1` and `facebook-ads:get-orders::acct_a::6;w=1`
Api call 3 would touch 2 **zones**: `facebook-ads::acct_b::10;w=1` and `facebook-ads:get-campaigns::acct_b::6;w=1`
Api call 2 would touch 2 **zones**: `facebook-ads::acct_b::10;w=1` and `facebook-ads:get-orders::acct_b::6;w=1`

Each zone's `zoneKey` is made up of three parts `<zoneId>::<reqId>::<policyId>`:

-   `zoneId` describes the zone in general, and the server will keep track of the limit policy/policies for this `zoneKey`
-   `reqId` describes the specific request, in terms relative to that zone. So in this case, it's the `accountId` because the zone rate limit is per account id.
-   `policyId` describes the policy being asked about. In our example, there is only one policy per rate limit, but many apis may have multiple policies for the same request, like a burst and a steady limit.

As you can imagine, the `zoneKey` might be complicated. But it will uniquely describe a particular rate limit policy being tracked by ramzor.

So the worker wanting to make the API calls would be responsible for:

-   figuring out which zone(s) the request belongs to (see `ramzor/src/utils/getZoneInfo.ts:getZoneInfoFromReq`)
-   asking the server permission for each relevant zone and policy
    -   making the request only if the server responds OK for all zones
    -   not making the requests and asking again later if the server responds NO

In our example, for each API Call, the worker would have to ask permission for each of the two zones.

The server sends a request with a list of `PermissionRequests`, which look like:

```
{
    zoneKey: 'facebook-ads:ads-management:endpoint1::accountId=acct_a&ip=127.0.0.1::100;w=60'
    policy: {
        maxCalls: 100,
        window: 60, // seconds
    },
}
```

The server keeps track of how many calls have been made under that policy and, if it's fewer than max calls, it:

-   increments a redis key (zoneKey) with the number of calls
-   sets the redis key to expire after {window} seconds, if this is the first known call
-   keeps track of when the window will expire, so it can tell other clients how long to wait once the limit has been reached

In our example, assuming no other API calls were made yet, the server would respond to the client with 200.
Immediately after this, the server's state (redis, in this example) will show something like:

```
{
    'facebook-ads::acct_a::10;w=1': 2, // out of 10
    'facebook-ads::acct_b::10;w=1': 2, // out of 10
    'facebook-ads:get-campaigns::acct_a::6;w=1': 1, // out of 6
    'facebook-ads:get-orders::acct_a::6;w=1': 1, // out of 6
    'facebook-ads:get-campaigns::acct_b::6;w=1': 1, // out of 6
    'facebook-ads:get-orders::acct_b::6;w=1': 1 // out of 6
}
```

The server will increment the keys with each new request to that zone, and expire each key after the window of the rate limit is over (here, in one second)

## Current State of the Code

-   The utils for getting the zone info from a request and matching a request to the zone are basically done and working fine.
-   The config is probably a bit complicated, but necessarily so. There may be better ways to implement it, but it shouldn't be so difficult to figure out, using the `types.ts` file and the examples
-   The `ramzor/server/stoplight.ts` file has some bugs. I think it's race conditions in checking and incrementing the zone counts -- i.e. how many requests have been sent for a `zoneId`

## To run it

From the root dir:

```
docker-compose up
```

then in another term window: `ts-node ramzor/src/client/testRamzor.ts`

You may need to `npm i -g ts-node` or just run it with node:

```
cd ramzor/
tsc
cd build/client/
node testRamzor.js
```

`testRamzor.ts` creates a bunch of request configs and then sends them to the `throttleRequests` function, which takes care of asking the ramzor server for permission to send the requests. The `fake-*` are api servers with the same rate limits enabled as are described by the `ramzor/config` files.
