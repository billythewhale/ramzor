import type { Request, Response, NextFunction, RequestHandler } from 'express';

type RateLimitConfig = { quota: number; window: number; params: string[] }[];

const rateLimitStore = new Map<string, { count: number; end: number }>();

const clock = {
  monotonic: () => {
    const time = process.hrtime.bigint();
    return Number(time / BigInt(1e6));
  },
};

const get = (obj: any, path: string, fallback?: any) => {
  const parts = path.split('.');
  let val = obj;
  for (const part of parts) {
    val = val[part];
    if (val === undefined) return fallback || undefined;
  }
  return val;
};

export function createRateLimitMiddlewares(
  config: RateLimitConfig
): RequestHandler[] {
  return config.map(
    (conf) =>
      function rateLimitMiddleware(
        req: Request,
        res: Response,
        next: NextFunction
      ) {
        const { quota, window, params } = conf;
        const now = Math.ceil(clock.monotonic() / 1000);
        let key = `${req.path}-${window}`;
        params.forEach((param) => {
          if (!get(req, param)) {
            throw new Error(`Missing required request property: ${param}`);
          }
          key += `-${get(req, param)}`;
        });
        if (!rateLimitStore.has(key)) {
          rateLimitStore.set(key, { count: 0, end: now + window });
          setTimeout(() => {
            rateLimitStore.delete(key);
          }, window * 1000);
        }
        if (++rateLimitStore.get(key).count > quota) {
          console.log(req.path + ' rate limit exceeded');
          return res
            .status(429)
            .header('Retry-After', `${+rateLimitStore.get(key).end - now + 1}`)
            .send('Too many requests');
        }
        const msg =
          `limit=${quota}, ` +
          `remaining=${quota - rateLimitStore.get(key).count}, ` +
          `reset=${rateLimitStore.get(key).end - now + 1}`;
        next();
      }
  );
}
