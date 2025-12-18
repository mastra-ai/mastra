import { ErrorCategory, ErrorDomain, MastraError } from "@mastra/core/error";
import { createStorageErrorId } from "@mastra/core/storage";
import type { TABLE_NAMES } from "@mastra/core/storage";
import type { Redis } from '@upstash/redis';
import { getKey, processRecord } from "../domains/utils";

export class UpstashDB {
    private client: Redis;

    constructor({ client }: { client: Redis }) {
        this.client = client;
    }

    async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
        const { key, processedRecord } = processRecord(tableName, record);

        try {
            await this.client.set(key, processedRecord);
        } catch (error) {
            throw new MastraError(
                {
                    id: createStorageErrorId('UPSTASH', 'INSERT', 'FAILED'),
                    domain: ErrorDomain.STORAGE,
                    category: ErrorCategory.THIRD_PARTY,
                    details: {
                        tableName,
                    },
                },
                error,
            );
        }
    }

    async get<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
        const key = getKey(tableName, keys);
        try {
            const data = await this.client.get<R>(key);
            return data || null;
        } catch (error) {
            throw new MastraError(
                {
                    id: createStorageErrorId('UPSTASH', 'LOAD', 'FAILED'),
                    domain: ErrorDomain.STORAGE,
                    category: ErrorCategory.THIRD_PARTY,
                    details: {
                        tableName,
                    },
                },
                error,
            );
        }
    }

    async scanAndDelete(pattern: string, batchSize = 10000): Promise<number> {
        let cursor = '0';
        let totalDeleted = 0;
        do {
            const [nextCursor, keys] = await this.client.scan(cursor, {
                match: pattern,
                count: batchSize,
            });
            if (keys.length > 0) {
                await this.client.del(...keys);
                totalDeleted += keys.length;
            }
            cursor = nextCursor;
        } while (cursor !== '0');
        return totalDeleted;
    }

    async scanKeys(pattern: string, batchSize = 10000): Promise<string[]> {
        let cursor = '0';
        let keys: string[] = [];
        do {
            const [nextCursor, batch] = await this.client.scan(cursor, {
                match: pattern,
                count: batchSize,
            });
            keys.push(...batch);
            cursor = nextCursor;
        } while (cursor !== '0');
        return keys;
    }

    async deleteData({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
        const pattern = `${tableName}:*`;
        try {
            await this.scanAndDelete(pattern);
        } catch (error) {
            throw new MastraError(
                {
                    id: createStorageErrorId('UPSTASH', 'CLEAR_TABLE', 'FAILED'),
                    domain: ErrorDomain.STORAGE,
                    category: ErrorCategory.THIRD_PARTY,
                    details: {
                        tableName,
                    },
                },
                error,
            );
        }
    }
}