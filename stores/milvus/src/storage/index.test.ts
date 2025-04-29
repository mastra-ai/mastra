import { TABLE_MESSAGES } from '@mastra/core/storage';
import { beforeAll, describe, expect, it } from 'vitest';
import { MilvusStorage } from './index';

describe('MilvusStorage', () => {
  let milvusStorage: MilvusStorage;
  beforeAll(async () => {
    // setup milvus client
    milvusStorage = new MilvusStorage('milvus', '127.0.0.1:19530', false, 'milvus-username', 'milvus-password');

    expect(milvusStorage).toBeDefined();
    expect((await milvusStorage.checkHealth()).isHealthy).toBe(true);
  });

  describe('Create table tests', () => {
    it('should create a collection', async () => {
      await milvusStorage.createTable({ tableName: TABLE_MESSAGES, schema: { id: { type: 'text' } } });
    });
  });
});
