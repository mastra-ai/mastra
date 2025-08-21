import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { StoreOperations } from '@mastra/core/storage';
import type { TABLE_NAMES, StorageColumn } from '@mastra/core/storage';
import type { Redis } from '@upstash/redis';
import { getKey, processRecord } from '../utils';

export class StoreOperationsUpstash extends StoreOperations {
  private client: Redis;

  constructor({ client }: { client: Redis }) {
    super();
    this.client = client;
  }

  async createTable({
    tableName: _tableName,
    schema: _schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    // For Redis/Upstash, tables are created implicitly when data is inserted
    // This method is a no-op for Redis-based storage
  }

  async alterTable({
    tableName: _tableName,
    schema: _schema,
    ifNotExists: _ifNotExists,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    // For Redis/Upstash, schema changes are handled implicitly
    // This method is a no-op for Redis-based storage
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    const pattern = `${tableName}:*`;
    try {
      await this.scanAndDelete(pattern);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_CLEAR_TABLE_FAILED',
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

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    return this.clearTable({ tableName });
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    const { key, processedRecord } = processRecord(tableName, record);

    try {
      await this.client.set(key, processedRecord);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_INSERT_FAILED',
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

  async batchInsert(input: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    const { tableName, records } = input;
    if (!records.length) return;

    const batchSize = 1000;
    try {
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const pipeline = this.client.pipeline();
        for (const record of batch) {
          const { key, processedRecord } = processRecord(tableName, record);
          pipeline.set(key, processedRecord);
        }
        await pipeline.exec();
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_BATCH_INSERT_FAILED',
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

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    const key = getKey(tableName, keys);
    try {
      const data = await this.client.get<R>(key);
      return data || null;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_LOAD_FAILED',
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

  async hasColumn(_tableName: TABLE_NAMES, _column: string): Promise<boolean> {
    // For Redis/Upstash, columns are dynamic and always available
    // This method always returns true for Redis-based storage
    return true;
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
}
