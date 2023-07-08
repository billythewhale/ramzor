import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { providers } from './urls';
import type { AxiosInstance } from 'axios';
import type { Request, Response, NextFunction } from 'express';
import type {
  Limit,
  PermissionRequest,
  RequestConfig,
  Zone,
  ZonesConfig,
} from '../types';
import { getZoneInfoFromReq } from '../utils/getZoneInfo';
import zonesConfig from '../config';
import { makeAxiosReq } from '../utils/makeAxiosReq';
import { promiseAllLimit } from '../utils/promiseAllLimit';

let ramzorClient: AxiosInstance = axios.create({
  baseURL: process.env.RAMZOR_URL || 'http://localhost:3003',
  method: 'GET',
  validateStatus: (status) => [200, 429].includes(status),
});

export async function throttleRequests(
  reqs: RequestConfig[]
): Promise<(any | string)[]> {
  return await promiseAllLimit(
    reqs,
    20,
    (r) =>
      throttleRequest(r)
        .then((res) => res.status)
        .catch((err) => {
          throw err;
        }),
    (err) => {
      throw err;
    }
  );
}

async function throttleRequest(req: RequestConfig): Promise<AxiosResponse> {
  const permissions = getZoneInfoFromReq(req, zonesConfig);
  console.log(`${req.url}/${req.path}: `, permissions);
  let n = 0;
  await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 300)));
  while (!(await askPermission(permissions))) {
    await new Promise((r) => {
      // exponential backoff from 100ms up to 5 min
      // TODO: use the retry-after header
      let wait =
        Math.min(Math.pow(2, n++), 3000) * 100 +
        Math.floor(Math.random() * 300);
      setTimeout(r, wait);
      console.log(`waiting ${wait}ms for ${req.url}`);
    });
  }
  console.log(`${req.url}/${req.path}: sending`);
  const axiosConfig: AxiosRequestConfig = makeAxiosReq(req);
  const response = await axios.request(axiosConfig);
  console.log(`${req.url}: ${response.status}`);
  return response;
}

async function askPermission(permissions: PermissionRequest[]) {
  try {
    const statuses = await Promise.all(
      permissions.map(async ({ zoneId, query }) => {
        // ramzor returns 429 if not allowed, ramzorClient will throw
        try {
          const resp = await ramzorClient.get(`/${zoneId}`, { params: query });
          if (resp.status === 429) {
            return false;
          }
          return true;
        } catch (err) {
          console.log('got error', err);
          throw err;
        }
      })
    );
    return statuses.every((s) => !!s);
  } catch (err) {
    console.log('rethrowing');
    throw err;
  }
}
