import { AxiosRequestConfig } from '@tw/ramzor';
import { v4 } from 'uuid';

export function makeAxiosReq(req: any): AxiosRequestConfig {
  let url = req.path;
  if (url.startsWith('/')) {
    url = url.slice(1);
  }
  return {
    baseURL: req.url,
    url,
    method: 'POST',
    data: req.body,
    headers: {
      ...req.headers,
      'x-tw-ramzor': v4(),
    },
  };
}
