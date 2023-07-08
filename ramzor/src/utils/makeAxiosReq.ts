import { AxiosRequestConfig } from 'axios';
import { RequestConfig } from '../types';

export function makeAxiosReq(req: RequestConfig): AxiosRequestConfig {
  let url = req.path;
  if (url.startsWith('/')) {
    url = url.slice(1);
  }
  return {
    baseURL: req.url,
    url,
    method: req.method,
    params: req.query,
    data: req.body,
    headers: req.headers,
  };
}
