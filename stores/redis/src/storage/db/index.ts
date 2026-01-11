import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId } from '@mastra/core/storage';
import type { TABLE_NAMES } from '@mastra/core/storage';

import { getKey, processRecord } from '../domains/utils';
import type { RedisClient } from '../types';

export class RedisDB {
  private client: RedisClient;

  constructor({ client }: { client: RedisClient }) {
    this.client = client;
  }

  getClient(): RedisClient {
    return this.client;
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, unknown> }): Promise<void> {
    const { key, processedRecord } = processRecord(tableName, record);

    try {
      await this.client.set(key, JSON.stringify(processedRecord));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('REDIS', 'INSERT', 'FAILED'),
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
      const data = await this.client.get(key);
      if (!data) {
        return null;
      }
      return JSON.parse(data) as R;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('REDIS', 'LOAD', 'FAILED'),
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
    let cursor = 0;
    let totalDeleted = 0;

    do {
      const result = await this.client.scan(cursor, { MATCH: pattern, COUNT: batchSize });

      if (result.keys.length > 0) {
        await this.client.del(result.keys);
        totalDeleted += result.keys.length;
      }

      cursor = result.cursor;
    } while (cursor !== 0);

    return totalDeleted;
  }

  async scanKeys(pattern: string, batchSize = 10000): Promise<string[]> {
    let cursor = 0;
    const keys: string[] = [];

    do {
      const result = await this.client.scan(cursor, { MATCH: pattern, COUNT: batchSize });

      keys.push(...result.keys);
      cursor = result.cursor;
    } while (cursor !== 0);

    return keys;
  }

  async deleteData({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    const pattern = `${tableName}:*`;
    try {
      await this.scanAndDelete(pattern);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('REDIS', 'CLEAR_TABLE', 'FAILED'),
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

export interface RedisDomainConfig {
  client: RedisClient;
}
