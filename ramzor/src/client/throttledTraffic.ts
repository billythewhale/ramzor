import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { providers } from './urls';
import type { AxiosInstance } from 'axios';
import type { Request, Response, NextFunction } from 'express';
import type { Limit, RequestConfig, Zone, ZonesConfig } from '../types';
import { getZoneIdsFromRequest } from '../utils/getZoneInfo';
import zonesConfig from '../config';
import { makeAxiosReq } from '../utils/makeAxiosReq';
import { promiseAllLimit } from '../utils/promiseAllLimit';

let ramzorClient: AxiosInstance = axios.create({
  baseURL: process.env.RAMZOR_URL || 'http://localhost:3003',
  method: 'GET',
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
  const zoneIds = getZoneIdsFromRequest(req, zonesConfig);
  let n = 0;
  while (!(await askPermission(zoneIds))) {
    await new Promise((r) => {
      // exponential backoff from 100ms up to 5 min
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

async function askPermission(zoneIds: string[]) {
  try {
    await Promise.all(
      zoneIds.map((zoneId) => {
        // ramzor returns 429 if not allowed, ramzorClient will throw
        ramzorClient.get(`/${zoneId}`);
      })
    );
    return true;
  } catch (err) {
    return false;
  }
}
