import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import type {
  Limit,
  PermissionRequest,
  Policy,
  RequestConfig,
  Zone,
  ZonesConfig,
} from '../types';
import { RateLimitsConfig } from '../types';
import { getZoneIdFromConfig } from '../utils/getZoneInfo';

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

  get zoneIds(): string[] {
    return Array.from(this.limits.keys());
  }

  get config(): string {
    return JSON.stringify(
      Array.from(this.limits.entries()).map(([zoneId, limits]) => ({
        for: zoneId,
        limits,
      })),
      null,
      2
    );
  }

  public async init(config?: ZonesConfig) {
    await this._connect();
    if (config) {
      this.loadConfig(config);
    }
  }

  public loadConfig(config: ZonesConfig) {
    config.forEach((zone) => {
      const zoneId = getZoneIdFromConfig(zone.for);
      this.limits.set(zoneId, zone.limits);
    });
  }

  public async checkRequest(info: PermissionRequest): Promise<boolean> {
    let limits = this.limits.get(info.zoneId);
    if (!limits) {
      throw new Error(`Zone ${info.zoneId} is not configured`);
    }
    debugger;
    const checks = limits
      .filter((limit) => this.doesLimitApply(limit, info.query))
      .map((limit) => {
        return limit.policies.map((policy) => {
          const reqId = this.getReqId(limit, info.query);
          const policyId = this.getPolicyId(limit, policy);
          return { key: `${info.zoneId}::${reqId}::${policyId}`, policy };
        });
      })
      .flat();
    try {
      const allChecked = await Promise.all(
        checks.map((obj) => this.check(obj))
      );
      const allAllowed = allChecked.every((c) => !!c);
      if (allAllowed) {
        // this is fragile, make it more atomic
        await Promise.all(checks.map((obj) => this.increment(obj)));
        return true;
      }
    } catch (e) {
      return false;
    }
  }

  private async check({
    key,
    policy,
  }: {
    key: string;
    policy: Policy;
  }): Promise<boolean> {
    const count = await this.redis.get(key);
    console.log(
      `[ ${count || 0} / ${policy.maxCalls} ] in ${policy.window} sec`,
      key
    );
    // one less than necessary, but errs on the side of never getting 429
    // in case two clients are checking the same call in a race condition
    if (count && parseInt(count) >= policy.maxCalls - 1) {
      return false;
    }
    return true;
  }

  private async increment({ key, policy }: { key: string; policy: Policy }) {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, policy.window);
    }
  }

  private doesLimitApply(limit: Limit, query: Partial<RequestConfig>): boolean {
    return limit.limitBy.reduce((applies, limitBy) => {
      return applies && query[limitBy] !== undefined;
    }, true);
  }

  private getReqId(limit: Limit, query: Partial<RequestConfig>): string {
    return limit.limitBy
      .map((limitBy) => limitBy + '=' + query[limitBy])
      .join('&');
  }

  private getPolicyId(limit: Limit, policy: Policy): string {
    return `${limit.limitBy.reduce((key, limitBy) => {
      return key + ':' + limitBy;
    }, 'limitby')}_${policy.window}`;
  }

  public async stop() {
    await this.redis.quit();
  }

  public async dangerouslyResetRedis() {
    console.log('Dangerously resetting redis');
    await this._resetRedis();
  }

  private async _connect() {
    await this.redis.connect();
  }

  private async _resetRedis() {
    await this.redis.del('*');
  }
}
