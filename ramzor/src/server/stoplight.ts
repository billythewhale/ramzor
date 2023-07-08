import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import type {
  PermissionRequest,
  RateLimitsConfig,
  Policy,
  PermissionResponse,
} from '../types';
import { monotonic } from '../utils/clock';

export class Stoplight {
  redis: RedisClientType;

  constructor() {
    this.redis = createClient({
      url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
      password: process.env.REDIS_PASSWORD,
    });
    this.redis.on('error', (err) => {
      console.log('Redis error', err);
    });
  }

  public async init() {
    await this._connect();
  }

  public async stop() {
    await this.redis.quit();
  }

  public async dangerouslyResetRedis() {
    console.log('Dangerously resetting redis');
    await this._resetRedis();
  }

  public async checkRequests(
    permissions: PermissionRequest[]
  ): Promise<PermissionResponse> {
    try {
      const allChecked = await Promise.all(
        permissions.map((permission) => this.check(permission))
      );
      const allAllowed = allChecked.every((c) => c.allowed);
      if (!allAllowed) {
        return allChecked
          .filter((c) => !c.allowed)
          .sort((a, b) => parseInt(b.retryAfter) - parseInt(a.retryAfter))[0]; // find the longest retryAfter
      }
      // this is fragile, make it more atomic
      await Promise.all(
        permissions.map((permission) => this.increment(permission))
      );
      return { allowed: true };
    } catch (e) {
      return { allowed: false };
    }
  }

  private async check({
    zoneKey,
    policy,
  }: PermissionRequest): Promise<PermissionResponse> {
    const count = await this.redis.get(zoneKey);
    // one less than necessary, but errs on the side of never getting 429
    // in case two clients are checking the same call in a race condition
    if (count && parseInt(count) >= policy.maxCalls - 1) {
      return { allowed: false, retryAfter: await this.getExpiration(zoneKey) };
    }
    return { allowed: true };
  }

  private async increment({
    zoneKey,
    policy,
  }: PermissionRequest): Promise<void> {
    const count = await this.redis.incr(zoneKey);
    console.log(
      `[ ${count || 0} / ${policy.maxCalls} ] in ${policy.window} sec`,
      zoneKey
    );
    if (count === 1) {
      await this.redis.expire(zoneKey, policy.window);
      await this.setExpiration(zoneKey, policy.window);
    }
  }

  private async setExpiration(zoneKey: string, window: number) {
    const now = Math.ceil(monotonic() / 1000);
    const expiration = now + window;
    await this.redis.set('expires:' + zoneKey, expiration);
  }

  public async getExpiration(zoneKey: string): Promise<string> {
    const now = Math.floor(monotonic() / 1000);
    const expiration = Number(await this.redis.get('expires:' + zoneKey));
    return (expiration - now).toString();
  }

  private async _connect() {
    await this.redis.connect();
  }

  private async _resetRedis() {
    await this.redis.del('*');
  }
}
