// Actual Cloudflare KV interface
export interface KVNamespace {
    get(key: string): Promise<string | null>;
    get(key: string, type: 'text'): Promise<string | null>;
    get<T>(key: string, type: 'json'): Promise<T | null>;
    put(key: string, value: string | ReadableStream | ArrayBuffer | FormData): Promise<void>;
    delete(key: string): Promise<void>;
    // List is actually on a different interface in real CF workers
    list(options?: { prefix?: string, limit?: number, cursor?: string }): Promise<{
        keys: { name: string }[];
        list_complete: boolean;
        cursor?: string;
    }>;
}

// Mock implementation for testing
export class MockKV implements KVNamespace {
    private store = new Map<string, string>();

    async get(key: string): Promise<string | null>;
    async get(key: string, type: 'text'): Promise<string | null>;
    async get<T>(key: string, type: 'json'): Promise<T | null>;
    async get<T>(key: string, type?: 'text' | 'json'): Promise<string | T | null> {
        const value = this.store.get(key);
        if (value === undefined) return null;

        if (type === 'json') {
            return JSON.parse(value) as T;
        }

        return value;
    }

    async put(key: string, value: string | ReadableStream | ArrayBuffer | FormData): Promise<void> {
        if (typeof value !== 'string') {
            throw new Error('MockKV only supports string values for testing');
        }
        this.store.set(key, value);
    }

    async delete(key: string): Promise<void> {
        this.store.delete(key);
    }

    async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
        keys: { name: string }[];
        list_complete: boolean;
        cursor?: string;
    }> {
        const allKeys = Array.from(this.store.keys())
            .filter(key => !options?.prefix || key.startsWith(options.prefix))
            .map(name => ({ name }));

        const start = options?.cursor ? parseInt(options.cursor) : 0;
        const limit = options?.limit ?? allKeys.length;
        const end = start + limit;
        const keys = allKeys.slice(start, end);
        const list_complete = end >= allKeys.length;

        return {
            keys,
            list_complete,
            cursor: list_complete ? undefined : end.toString()
        };
    }
}

export class CloudflareKVProvider {
    private namespace: KVNamespace;

    constructor(namespace: KVNamespace) {
        this.namespace = namespace;
    }

    async get<T>(key: string): Promise<T | null> {
        return this.namespace.get<T>(key, 'json');
    }

    async set(key: string, value: any) {
        await this.namespace.put(key, JSON.stringify(value));
    }

    async del(key: string) {
        await this.namespace.delete(key);
    }

    async sadd(key: string, value: string) {
        const set = await this.get<string[]>(key) || [];
        if (!set.includes(value)) {
            set.push(value);
            await this.set(key, set);
            return 1;
        }
        return 0;
    }

    async srem(key: string, value: string) {
        const set = await this.get<string[]>(key) || [];
        const index = set.indexOf(value);
        if (index !== -1) {
            set.splice(index, 1);
            await this.set(key, set);
            return 1;
        }
        return 0;
    }

    async smembers(key: string): Promise<string[]> {
        return await this.get<string[]>(key) || [];
    }

    async flushall() {
        let cursor: string | undefined;
        do {
            const result = await this.namespace.list({ cursor });
            await Promise.all(result.keys.map(key => this.namespace.delete(key.name)));
            cursor = result.cursor;
        } while (cursor);
    }

    async getWithVersion<T>(key: string): Promise<{ data: T | null; version: number }> {
        const versionKey = `${key}:version`;
        const [data, version] = await Promise.all([
            this.get<T>(key),
            this.get<number>(versionKey).then(v => v || 0)
        ]);
        return { data, version };
    }

    async setWithVersion<T>(key: string, value: T, expectedVersion: number): Promise<boolean> {
        const versionKey = `${key}:version`;
        const currentVersion = await this.get<number>(versionKey) || 0;

        if (currentVersion !== expectedVersion) {
            return false;
        }

        await Promise.all([
            this.set(key, value),
            this.set(versionKey, expectedVersion + 1)
        ]);

        return true;
    }
}