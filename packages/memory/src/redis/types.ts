export interface RedisClient {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<any>;
    del(key: string): Promise<any>;
    sadd(key: string, ...values: string[]): Promise<any>;
    srem(key: string, ...values: string[]): Promise<any>;
    smembers(key: string): Promise<string[]>;
    flushall(): Promise<any>;
    pipeline(): RedisPipeline;
}

export interface RedisPipeline {
    get(key: string): RedisPipeline;
    set(key: string, value: any): RedisPipeline;
    del(key: string): RedisPipeline;
    srem(key: string, value: string): RedisPipeline;
    exec(): Promise<any>;
}