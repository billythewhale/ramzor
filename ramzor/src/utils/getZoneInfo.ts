import {
  Limit,
  Policy,
  RequestConfig,
  RequestMatcher,
  PermissionRequest,
  ZoneDescriber,
  ZonesConfig,
} from '../types';
import { matchRequestToConfig } from './matchRequest';

export function getZoneId(zoneFor: ZoneDescriber): string {
  let key = zoneFor.provider;
  if (zoneFor.apiName) {
    key += `:${zoneFor.apiName}`;
  }
  if (zoneFor.request) {
    key += ':req';
    key += getSubKey(zoneFor.request);
  }
  return key;
}

function getSubKey(matcher: RequestMatcher): string {
  let key = '';
  Object.keys(matcher).forEach((k) => {
    if (typeof matcher[k] === 'object') {
      if (matcher[k] instanceof RegExp) {
        key += `_${k}_${matcher[k].toString().replaceAll(/\W/g, '')}`;
      } else {
        key += `_${k}`;
        key += getSubKey(matcher[k]);
      }
    } else if (typeof matcher[k] === 'function') {
      key += `_${k}`;
    } else if (['string', 'number'].includes(typeof matcher[k])) {
      key += `_${k}_${matcher[k].toString().replaceAll(/\W/g, '')}`;
    }
  });
  return key;
}

export function getZoneInfoFromReq(
  req: RequestConfig,
  conf: ZonesConfig
): PermissionRequest[] {
  const zones = matchRequestToConfig(req, conf);
  return zones
    .map((zone) =>
      zone.limits
        .filter((limit) => doesLimitApply(limit, req))
        .map((limit) =>
          limit.policies.map((policy) => ({
            zoneKey: [
              getZoneId(zone.for),
              getReqId(limit, req),
              getPolicyId(limit, policy),
            ].join('::'),
            policy,
          }))
        )
    )
    .flat(2);
}

function doesLimitApply(limit: Limit, req: RequestConfig): boolean {
  return limit.limitBy.every((limitBy) => !!get(req, limitBy));
}

function getReqId(limit: Limit, req: RequestConfig): string {
  return limit.limitBy
    .map((limitBy) => limitBy + '=' + get(req, limitBy))
    .join('&');
}

function getPolicyId(limit: Limit, policy: Policy): string {
  return `${policy.maxCalls};w=${policy.window}`;
}

function get(obj: any, path: string): string {
  const pathParts = path.split('.');
  return pathParts
    .reduce((o, p) => {
      if (!o || !o[p]) {
        return '';
      }
      return o[p];
    }, obj)
    .toString();
}
