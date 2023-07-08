import type {
  RequestConfig,
  RequestMatcher,
  Matcher,
  ZonesConfig,
  Zone,
} from '../types';

export function matchRequestToConfig(
  req: RequestConfig,
  zones: ZonesConfig
): Zone[] {
  return zones.filter((z) => {
    if (z.for.provider !== req.provider) {
      return false;
    }
    if (z.for.apiName && z.for.apiName !== req.apiName) {
      return false;
    }
    if (!z.for.request) {
      return true;
    }
    return matchRequest(req, z.for.request);
  });
}

function matchRequest(req: RequestConfig, matcher: RequestMatcher): boolean {
  const reqField = Object.keys(matcher)[0];
  if (['url', 'path'].includes(reqField)) {
    match(req[reqField], matcher[reqField]);
  }
  if (['query', 'body', 'params', 'headers'].includes(reqField)) {
    return Object.keys(matcher[reqField]).every((k) => {
      return match(req[reqField]?.[k], matcher[reqField][k]);
    });
  }
}

function match(value: any, matcher: Matcher) {
  const matcherType = Object.keys(matcher)[0];
  const matcherFn = matcherFunctions[matcherType];
  if (!matcherFn) {
    throw new Error(`No matcher function for matcher type: ${matcherType}`);
  }
  return matcherFn(value, matcher[matcherType]);
}

const matcherFunctions: Record<
  keyof Matcher,
  (
    val: any,
    condition: string | string[] | RegExp | Function | boolean
  ) => boolean
> = {
  match: (value: any, condition: string | RegExp) => {
    if (typeof condition === 'string') {
      return value.includes(condition);
    } else if (condition instanceof RegExp) {
      return condition.test(value);
    }
  },
  exact: (value: any, condition: string) => {
    return value === condition;
  },
  exists: (value: any, condition: boolean) => {
    if (condition) {
      return !!value;
    } else {
      return !value;
    }
  },
  in: (value: any, condition: string[]) => {
    return condition.includes(value);
  },
  notin: (value: any, condition: string[]) => {
    return !condition.includes(value);
  },
  matchFn: (value: any, condition: Function) => {
    return condition(value);
  },
};
