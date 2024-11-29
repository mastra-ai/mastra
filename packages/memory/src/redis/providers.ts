import { Redis as UpstashRedis } from '@upstash/redis';
import { createClient } from 'redis'
import { RedisClient, RedisPipeline } from './types';

// Helper functions for date handling
function serializeData(data: any): any {
    if (data === null || data === undefined) return data;

    if (data instanceof Date) {
        return { __type: 'Date', value: data.toISOString() };
    }

    if (Array.isArray(data)) {
        return data.map(item => serializeData(item));
    }

    if (typeof data === 'object') {
        return Object.keys(data).reduce((acc, key) => {
            acc[key] = serializeData(data[key]);
            return acc;
        }, {} as any);
    }

    return data;
}

function deserializeData(data: any): any {
    if (data === null || data === undefined) return data;

    if (typeof data === 'object' && data.__type === 'Date') {
        return new Date(data.value);
    }

    if (Array.isArray(data)) {
        return data.map(item => deserializeData(item));
    }

    if (typeof data === 'object') {
        return Object.keys(data).reduce((acc, key) => {
            acc[key] = deserializeData(data[key]);
            return acc;
        }, {} as any);
    }

    return data;
}


// Provider for Upstash/Vercel KV
export class UpstashProvider implements RedisClient {
    private client: UpstashRedis;

    constructor(url: string, token: string) {
        this.client = new UpstashRedis({
            url,
            token,
        });
    }
    async get(key: string) {
        const data = await this.client.get(key);
        return deserializeData(data);
    }

    async set(key: string, value: any) {
        return this.client.set(key, serializeData(value));
    }
    async del(key: string) { return this.client.del(key); }
    async sadd(key: string, value: string) { return this.client.sadd(key, value); }
    async srem(key: string, value: string) { return this.client.srem(key, value); }
    async smembers(key: string) { return this.client.smembers(key); }
    async flushall() { return this.client.flushall(); }
    pipeline() {
        const multi = this.client.multi();
        const pipeline: RedisPipeline = {
            get: (key: string) => {
                multi.get(key);
                return pipeline;
            },
            set: (key: string, value: any) => {
                multi.set(key, JSON.stringify(serializeData(value)));
                return pipeline;
            },
            del: (key: string) => {
                multi.del(key);
                return pipeline;
            },
            srem: (key: string, value: string) => {
                multi.srem(key, value);
                return pipeline;
            },
            exec: async () => {
                const results = await multi.exec();
                return results.map(result => {
                    try {
                        // For get operations that return string data
                        if (typeof result === 'string') {
                            return deserializeData(JSON.parse(result));
                        }
                        // For array results (like from lists/sets)
                        if (Array.isArray(result)) {
                            return result.map(item => {
                                try {
                                    return typeof item === 'string' ? deserializeData(JSON.parse(item)) : item;
                                } catch {
                                    return item;
                                }
                            });
                        }
                        return result;
                    } catch {
                        return result;
                    }
                });
            }
        }
        return pipeline;
    }
}

export class LocalRedisProvider implements RedisClient {
    private client: any;

    constructor() {
        this.client = createClient({ url: 'redis://localhost:6379' });
        this.client.connect();
    }

    async get(key: string) {
        const data = await this.client.get(key);
        return data ? deserializeData(JSON.parse(data)) : null;
    }

    async set(key: string, value: any) {
        return this.client.set(key, JSON.stringify(serializeData(value)));
    }
    async del(key: string) { return this.client.del(key); }
    async sadd(key: string, value: string) { return this.client.sAdd(key, value); }
    async srem(key: string, value: string) { return this.client.sRem(key, value); }
    async smembers(key: string) { return this.client.sMembers(key); }
    async flushall() { return this.client.flushAll(); }

    pipeline() {
        const multi = this.client.multi();
        const pipeline: RedisPipeline = {
            get: (key: string) => {
                multi.get(key);
                return pipeline;
            },
            set: (key: string, value: any) => {
                multi.set(key, JSON.stringify(value));
                return pipeline;
            },
            del: (key: string) => {
                multi.del(key);
                return pipeline;
            },
            srem: (key: string, value: string) => {
                multi.sRem(key, value);
                return pipeline;
            },
            exec: async () => {
                return multi.exec();
            }
        };
        return pipeline;
    }

    async quit() {
        await this.client.quit();
    }
}