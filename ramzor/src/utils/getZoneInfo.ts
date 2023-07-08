import {
  Limit,
  RequestConfig,
  RequestMatcher,
  ZoneDescriber,
  ZonesConfig,
} from '../types';
import { matchRequestToConfig } from './matchRequest';

export function getZoneKeyFromConfig(zoneFor: ZoneDescriber): string {
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

export function getZoneIdsFromRequest(
  req: RequestConfig,
  conf: ZonesConfig
): string[] {
  const zones = matchRequestToConfig(req, conf);
  return zones
    .map((zone) =>
      zone.limits.map(
        (limit) =>
          getZoneKeyFromConfig(zone.for) +
          (limit.limitBy.length ? '::' + getReqKey(req, limit) : '')
      )
    )
    .flat();
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

function getReqKey(req: RequestConfig, limit: Limit): string {
  return limit.limitBy
    .reduce((key, limitBy) => {
      return key + get(req, limitBy);
    }, '')
    .replaceAll(/\W/g, '');
}
