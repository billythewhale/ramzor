import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import type { Limit, Policy, Zone, ZonesConfig } from '../types';
import { RateLimitsConfig } from '../types';
import { getZoneKeyFromConfig } from '../utils/getZoneInfo';

export class Stoplight {
  redis: RedisClientType;
  limits: Map<string, Limit[]>;

  constructor() {
    this.redis = createClient({
      url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
      password: process.env.REDIS_PASSWORD,
    });
    this.redis.on('error', (err) => {
      console.log('Redis error', err);
    });
    this.limits = new Map();
  }

  get zoneKeys(): string[] {
    return Array.from(this.limits.keys());
  }

  public async init(config?: ZonesConfig) {
    await this._connect();
    if (config) {
      this.loadConfig(config);
    }
  }

  public loadConfig(config: ZonesConfig) {
    config.forEach((zone) => {
      const zoneKey = getZoneKeyFromConfig(zone.for);
      this.limits.set(zoneKey, zone.limits);
    });
  }

  public async checkRequest(zoneId: string): Promise<boolean> {
    const [zoneKey, reqKey] = zoneId.split('::');
    const limits = this.limits.get(zoneKey);
    if (!limits) {
      throw new Error(`Zone ${zoneKey} is not configured`);
    }
    try {
      if (
        (
          await Promise.all(
            limits
              .map((limit) =>
                limit.policies.map((policy) => this.check(policy, zoneId))
              )
              .flat()
          )
        ).reduce((a, b) => a && b, true)
      ) {
        // this is fragile, make it more atomic
        await Promise.all(
          limits
            .map((limit) =>
              limit.policies.map((policy) =>
                this.increment(limit, policy, zoneId)
              )
            )
            .flat()
        );
        return true;
      }
    } catch (e) {
      return false;
    }
  }

  private async check(policy: Policy, zoneId: string): Promise<boolean> {
    const count = await this.redis.get(zoneId);
    console.log('checking', zoneId, count);
    // one less than necessary, but errs on the side of never getting 429
    // in case two clients are checking the same call in a race condition
    if (count && parseInt(count) >= policy.maxCalls - 1) {
      return false;
    }
    return true;
  }

  private async increment(limit: Limit, policy: Policy, zoneId: string) {
    console.log('increment', zoneId);
    const key = `${zoneId}--${this.getLimitKey(limit, policy)}`;
    console.log('key', key);
    const count = await this.redis.incr(key);
    console.log('count', count, policy.maxCalls);
    if (count === 1) {
      await this.redis.expire(key, policy.window);
    }
  }

  private getLimitKey(limit: Limit, policy: Policy): string {
    return `${limit.limitBy.reduce((key, limitBy) => {
      return key + ':' + limitBy;
    }, 'limitby')}_${policy.window}`;
  }

  public async stop() {
    await this.redis.quit();
  }

  public async dangerouslyResetRedis() {
    await this._resetRedis();
  }

  private async _connect() {
    await this.redis.connect();
  }

  private async _resetRedis() {
    await this.redis.del('*');
  }
}
