import type { StorageColumn } from '@mastra/core/storage';
import { TABLE_MESSAGES } from '@mastra/core/storage';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MilvusStorage } from './index';

describe('MilvusStorage', () => {
  let milvusStorage: MilvusStorage;
  beforeAll(async () => {
    // setup milvus client
    milvusStorage = new MilvusStorage(
      'milvus',
      { address: '127.0.0.1:19530' },
      false,
      'milvus-username',
      'milvus-password',
    );

    expect(milvusStorage).toBeDefined();
    expect((await milvusStorage.checkHealth()).isHealthy).toBe(true);
  });

  afterAll(async () => {
    await milvusStorage.dropTable({ tableName: TABLE_MESSAGES });
  });

  describe('Create table', () => {
    it('should create an empty table with given schema', async () => {
      const schema: Record<string, StorageColumn> = {
        id: { type: 'bigint', nullable: false, primaryKey: true },
        threadId: { type: 'uuid', nullable: false },
        referenceId: { type: 'bigint', nullable: true },
        messageType: { type: 'text', nullable: true },
        content: { type: 'text', nullable: true },
        createdAt: { type: 'timestamp', nullable: true },
        metadata: { type: 'jsonb', nullable: true },
      };

      await milvusStorage.createTable({ tableName: TABLE_MESSAGES, schema });

      // Verify table exists and schema is correct
      const tableSchema = await milvusStorage.getTableSchema(TABLE_MESSAGES);

      expect(tableSchema).toBeDefined();
      tableSchema.forEach(column => {
        const key = Object.keys(column)[0];
        const value = column[key];

        expect(key).toBeDefined();
        expect(value).toBeDefined();
        expect(value.type).toBeDefined();
        expect(value.nullable).toBeDefined();
        expect(value.primaryKey).toBeDefined();
      });
    });
  });
});
