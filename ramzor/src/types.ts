export type Matcher =
  | { matchFn: (value: any) => boolean }
  | { match: string | RegExp }
  | { exact: string }
  | { notin: string[] }
  | { in: string[] }
  | { exists: boolean };

export type RequestMatcher =
  | { url: Matcher }
  | { path: Matcher }
  | { query: { [key: string]: Matcher } }
  | { body: { [key: string]: Matcher } }
  | { params: { [key: string]: Matcher } }
  | { headers: { [key: string]: Matcher } };

export type RequestConfig = {
  provider: string;
  apiName?: string;
  url?: string; // full url
  path?: string; // path only
  query?: { [key: string]: string }; // query params
  body?: { [key: string]: string }; // body params
  params?: { [key: string]: string }; // path params
  headers?: { [key: string]: string };
  method?: string;
};

/* Zone id gets built from zone describer:
 * {
 *   provider: 'facebook-ads',
 *   apiName: 'ads_management',
 *   request: {
 *     path: {
 *       match: /\/accounts\/\w+/info,
 *     },
 *   },
 * }
 *
 * becomes: facebook-ads:ads_management:req_path_match_accountswinfo
 *
 */
export type ZoneDescriber = {
  provider: string;
  apiName?: string;
  request?: RequestMatcher;
  // add more here if needed
  description?: string;
};

export type Zone = {
  for: ZoneDescriber;
  limits: Limit[];
};

export type Limit = {
  limitBy: string[]; // where req[limitBy[number]] exists
  policies: Policy[];
};

export type Policy = {
  window: number; // in SECONDS
  maxCalls: number; // max number of requests in the window
  description: string;
};

export type PermissionRequest = {
  zoneKey: string;
  policy: Policy;
};

export type PermissionResponse = {
  allowed: boolean;
  retryAfter?: string;
};

export type ZonesConfig = Zone[];

export type RateLimitsConfig = {
  zones: ZonesConfig;
  policyHeader?: string;
  retryAfterHeader?: string;
  defaultLimit?: Limit;
};
