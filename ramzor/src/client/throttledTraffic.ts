import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { providers } from './urls';
import type { AxiosInstance } from 'axios';
import type { Request, Response, NextFunction } from 'express';
import type {
  Limit,
  Ask,
  Answer,
  RequestConfig,
  Zone,
  ZonesConfig,
} from '../types';
import { getZoneInfoFromReq } from '../utils/getZoneInfo';
import zonesConfig from '../config';
import { makeAxiosReq } from '../utils/makeAxiosReq';
import { promiseAllLimit } from '../utils/promiseAllLimit';
import { monotonic } from '../utils/clock';

let ramzorClient: AxiosInstance = axios.create({
  baseURL: process.env.RAMZOR_URL || 'http://localhost:3003',
  method: 'GET',
  validateStatus: (status) => [200, 429].includes(status), // ramzor returns 429 when rate is too hot
});

let totalReqs = 0;
let attemptedReqs = 0;
let successReqs = 0;
let waitingReqs = 0;
let now = monotonic();
let running = false;

export async function throttleRequests(
  reqs: RequestConfig[]
): Promise<(any | string)[]> {
  totalReqs += reqs.length;
  running = true;
  logResults();
  let promises: Promise<number>[] = [];
  let results: number[] = [];
  for (let req of reqs) {
    await new Promise((r) => setTimeout(r, 5)); // don't send all 13k reqs at once
    promises.push(
      throttleRequest(req)
        .then((res) => results.push(res.status))
        .catch((err) => {
          throw err;
        })
    );
  }
  await Promise.all(promises);
  running = false;
  return results;
}

async function throttleRequest(req: RequestConfig): Promise<AxiosResponse> {
  attemptedReqs++;
  const permissions: Ask[] = getZoneInfoFromReq(req, zonesConfig);
  let n = 0;
  let wait = 0;
  await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 300))); // jittter
  while (true) {
    waitingReqs++;
    const { allowed, retryAfter } = await askPermission(permissions);
    if (allowed) {
      successReqs++;
      waitingReqs--;
      break;
    }
    await new Promise((r) => {
      // exponential backoff from 100ms up to 5 min
      // TODO: use the retry-after header
      wait =
        (retryAfter !== undefined
          ? +retryAfter * 1000
          : Math.min(Math.pow(2, n++), 3000) * 100) +
        Math.floor(Math.random() * 300);
      setTimeout(r, wait);
    });
    waitingReqs--;
  }
  const axiosConfig: AxiosRequestConfig = makeAxiosReq(req);
  const response = await axios.request(axiosConfig);
  return response;
}

async function askPermission(permissions: Ask[]): Promise<Answer> {
  const resp = await ramzorClient.post(`/check`, { permissions });
  if (resp.status === 429) {
    return { allowed: false, retryAfter: resp.headers['retry-after'] };
  }
  return { allowed: true };
}

async function logResults() {
  while (running) {
    const elapsed = Math.floor((monotonic() - now) / 1000);
    process.stdout.write(
      `total: ${totalReqs}, attempted: ${attemptedReqs}, success: ${successReqs}, waiting: ${waitingReqs}, time: ${toTimeString(
        elapsed
      )}                                                  `
    );
    process.stdout.write('\r');
    await new Promise((r) => setTimeout(r, 1000));
  }
  process.stdout.write('\n');
}

function toTimeString(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const hrs = hours.toString().padStart(2, '0');
  const minutes = Math.floor((seconds - hours * 3600) / 60);
  const mins = minutes.toString().padStart(2, '0');
  const secs = (seconds - hours * 3600 - minutes * 60)
    .toString()
    .padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}
