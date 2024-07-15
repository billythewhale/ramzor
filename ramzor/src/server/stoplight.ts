import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import type { Ask, RateLimitsConfig, Policy, Answer } from '../types';
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

  public async checkRequests(asks: Ask[]): Promise<Answer> {
    try {
      const allChecked = await Promise.all(asks.map((ask) => this.check(ask)));
      const allAllowed = allChecked.every((c) => c.allowed);
      if (!allAllowed) {
        return allChecked
          .filter((c) => !c.allowed)
          .sort((a, b) => parseInt(b.retryAfter) - parseInt(a.retryAfter))[0]; // find the longest retryAfter
      }
      // this is fragile, make it more atomic
      await Promise.all(asks.map((ask) => this.increment(ask)));
      return { allowed: true };
    } catch (e) {
      return { allowed: false };
    }
  }

  private async check({ zoneKey, policy }: Ask): Promise<Answer> {
    const count = await this.redis.get(zoneKey);
    // one less than necessary, but errs on the side of never getting 429
    // in case two clients are checking the same call in a race condition
    if (count && parseInt(count) >= policy.maxCalls - 1) {
      return { allowed: false, retryAfter: await this.getExpiration(zoneKey) };
    }
    return { allowed: true };
  }

  private async increment({ zoneKey, policy }: Ask): Promise<void> {
    const count = await this.redis.incr(zoneKey);
    if (count > policy.maxCalls) {
      throw new Error('Too many calls: ' + zoneKey);
    }
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
