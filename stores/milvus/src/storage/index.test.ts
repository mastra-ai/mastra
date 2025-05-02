import type { StorageColumn } from '@mastra/core/storage';
import { TABLE_MESSAGES } from '@mastra/core/storage';
import { afterAll, beforeAll, afterEach, describe, expect, it, beforeEach } from 'vitest';
import { MilvusStorage } from './index';

interface MessageRecord {
  id: number;
  threadId: string;
  referenceId: number;
  messageType: string;
  content: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

function generateRecords(count: number): MessageRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    threadId: `00000000-0000-4000-a000-${(1000000000000 + index).toString(16).padStart(12, '0')}`,
    referenceId: index + 1,
    messageType: 'text',
    content: `Test message ${index + 1}`,
    createdAt: new Date(),
    metadata: { testIndex: index, foo: 'bar' },
  }));
}

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
    await milvusStorage.clearTable({ tableName: TABLE_MESSAGES });
  });

  describe('Create table', () => {
    afterEach(async () => {
      await milvusStorage.clearTable({ tableName: TABLE_MESSAGES });
    });

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

    it('should create a table with only required fields', async () => {
      const minimalSchema: Record<string, StorageColumn> = {
        id: { type: 'bigint', nullable: false, primaryKey: true },
      };

      await milvusStorage.createTable({ tableName: TABLE_MESSAGES, schema: minimalSchema });

      // Verify table exists and schema is correct
      const tableSchema = await milvusStorage.getTableSchema(TABLE_MESSAGES);
      console.log(tableSchema);

      expect(tableSchema).toBeDefined();
      expect(tableSchema.length).toBe(2); // id and vector

      const idColumn = tableSchema[0]['id'];
      expect(idColumn.type).toBe('bigint');
      expect(idColumn.nullable).toBe(false);
      expect(idColumn.primaryKey).toBe(true);
    });

    it('should not throw when creating a table that already exists', async () => {
      const duplicateTableName = TABLE_MESSAGES;
      const schema: Record<string, StorageColumn> = {
        id: { type: 'bigint', nullable: false, primaryKey: true },
        name: { type: 'text', nullable: false },
      };

      // Create the table first
      await milvusStorage.createTable({ tableName: duplicateTableName, schema });

      // Try to create it again - should not throw
      await expect(milvusStorage.createTable({ tableName: duplicateTableName, schema })).resolves.not.toThrow();
    });

    it('should create a table with all supported data types', async () => {
      const allTypesTableName = TABLE_MESSAGES;
      const allTypesSchema: Record<string, StorageColumn> = {
        id: { type: 'bigint', nullable: false, primaryKey: true },
        textField: { type: 'text', nullable: true },
        intField: { type: 'integer', nullable: true },
        bigintField: { type: 'bigint', nullable: true },
        jsonField: { type: 'jsonb', nullable: true },
        timestampField: { type: 'timestamp', nullable: true },
        uuidField: { type: 'uuid', nullable: true },
      };

      await milvusStorage.createTable({ tableName: allTypesTableName, schema: allTypesSchema });

      // Verify table exists and schema is correct
      const tableSchema = await milvusStorage.getTableSchema(allTypesTableName);

      expect(tableSchema).toBeDefined();
      expect(tableSchema.length).toBe(Object.keys(allTypesSchema).length + 1); // +1 for vector field

      // Verify each field type
      const fieldMap = tableSchema.reduce(
        (acc, column) => {
          const key = Object.keys(column)[0];
          acc[key] = column[key];
          return acc;
        },
        {} as Record<string, any>,
      );

      expect(fieldMap.id.type).toBe('bigint');
      expect(fieldMap.textField.type).toBe('text');
      expect(fieldMap.intField.type).toBe('integer');
      expect(fieldMap.bigintField.type).toBe('bigint');
      expect(fieldMap.jsonField.type).toBe('jsonb');
      expect(fieldMap.timestampField.type).toBe('bigint');
      expect(fieldMap.uuidField.type).toBe('text');
    });

    it('should handle complex schema with indexes and constraints', async () => {
      const complexTableName = TABLE_MESSAGES;
      const complexSchema: Record<string, StorageColumn> = {
        id: { type: 'bigint', nullable: false, primaryKey: true },
        userId: { type: 'bigint', nullable: false },
        title: { type: 'text', nullable: false },
        description: { type: 'text', nullable: true },
        tags: { type: 'jsonb', nullable: true },
        createdAt: { type: 'timestamp', nullable: false },
      };

      await milvusStorage.createTable({ tableName: complexTableName, schema: complexSchema });

      // Verify table exists and schema is correct
      const tableSchema = await milvusStorage.getTableSchema(complexTableName);

      expect(tableSchema).toBeDefined();
      expect(tableSchema.length).toBe(Object.keys(complexSchema).length + 1); // +1 for vector field

      // Verify primary key field exists
      const hasIdField = tableSchema.some(column => {
        const key = Object.keys(column)[0];
        return key === 'id' && column[key].primaryKey === true;
      });

      expect(hasIdField).toBe(true);
    });
  });

  describe('Insert operations', () => {
    beforeEach(async () => {
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
    });

    afterEach(async () => {
      await milvusStorage.clearTable({ tableName: TABLE_MESSAGES });
    });

    it('should insert a record', async () => {
      const tableName = TABLE_MESSAGES;
      const record = generateRecords(1)[0];

      expect(await milvusStorage.insert({ tableName, record })).resolves.not.toThrow();
    });

    it('should throw if varchar max length is exceeded', async () => {
      const tableName = TABLE_MESSAGES;
      const record = generateRecords(1)[0];
      record.content = 'a'.repeat(1000);

      expect(await milvusStorage.insert({ tableName, record })).rejects.toThrow();
    });

    it('should throw if jsonb max length is exceeded', async () => {
      const tableName = TABLE_MESSAGES;
      const record = generateRecords(1)[0];
      record.metadata = { foo: 'bar' };

      expect(await milvusStorage.insert({ tableName, record })).rejects.toThrow();
    });
  });
});
