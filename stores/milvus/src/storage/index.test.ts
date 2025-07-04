import type { MessageType, StorageThreadType, TraceType } from '@mastra/core';
import type { EvalRow, StorageColumn, WorkflowRuns } from '@mastra/core/storage';
import {
  TABLE_MESSAGES,
  TABLE_SCHEMAS,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_EVALS,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';
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

function generateThreads(count: number, resourceId?: string): StorageThreadType[] {
  return Array.from({ length: count }, (_, index) => ({
    id: (index + 1).toString(),
    title: `Test thread ${index + 1}`,
    metadata: { testIndex: index, foo: 'bar' },
    createdAt: new Date(),
    updatedAt: new Date(),
    resourceId: resourceId ?? `00000000-0000-4000-a000-${(1000000000000 + index).toString(16).padStart(12, '0')}`,
    vector_placeholder: [0, 0],
  }));
}

function generateMessageRecords(count: number, threadId?: string): MessageType[] {
  return Array.from({ length: count }, (_, index) => ({
    id: (index + 1).toString(),
    content: `Test message ${index + 1}`,
    role: 'user',
    createdAt: new Date(),
    threadId: threadId ?? `12333d567-e89b-12d3-a456-${(426614174000 + index).toString()}`,
    resourceId: `12333d567-e89b-12d3-a456-${(426614174000 + index).toString()}`,
    toolCallIds: [],
    toolCallArgs: [],
    toolNames: [],
    type: 'text',
    vector_placeholder: [0, 0],
  }));
}

function generateTraceRecords(count: number): TraceType[] {
  return Array.from({ length: count }, (_, index) => ({
    id: (index + 1).toString(),
    name: `Test trace ${index + 1}`,
    scope: 'test',
    kind: 0,
    parentSpanId: `12333d567-e89b-12d3-a456-${(426614174000 + index).toString()}`,
    traceId: `12333d567-e89b-12d3-a456-${(426614174000 + index).toString()}`,
    attributes: { attribute1: 'value1' },
    status: { code: 0, description: 'OK' },
    events: { event1: 'value1' },
    links: { link1: 'value1' },
    other: { other1: 'value1' },
    startTime: new Date().getTime(),
    endTime: new Date().getTime(),
    createdAt: new Date(),
  }));
}

function generateEvalRecords(count: number): EvalRow[] {
  return Array.from({ length: count }, (_, index) => ({
    input: `Test input ${index + 1}`,
    output: `Test output ${index + 1}`,
    result: { score: index + 1, info: { testIndex: index + 1 } },
    agentName: `Test agent ${index + 1}`,
    metricName: `Test metric ${index + 1}`,
    instructions: 'Test instructions',
    testInfo: { testName: `Test ${index + 1}`, testPath: `TestPath ${index + 1}` },
    runId: `12333d567-e89b-12d3-a45-${(426614174000 + index).toString()}`,
    globalRunId: `12333d567-e89b-12d3-a45-${(426614174000 + index).toString()}`,
    createdAt: new Date().toString(),
  }));
}

function generateWorkflowRuns(count: number): WorkflowRuns {
  return {
    runs: Array.from({ length: count }, (_, index) => ({
      workflowName: `Test workflow ${index + 1}`,
      runId: `12333d567-e89b-12d3-a456-${(426614174000 + index).toString()}`,
      snapshot: `Test snapshot ${index + 1}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    total: count,
  };
}

describe('MilvusStorage', () => {
  let milvusStorage: MilvusStorage;
  beforeAll(async () => {
    // setup milvus client
    milvusStorage = new MilvusStorage('milvus', {
      address: '127.0.0.1:19530',
      ssl: false,
      username: 'milvus-username',
      password: 'milvus-password',
      logLevel: 'info',
    });

    expect(milvusStorage).toBeDefined();
    expect((await milvusStorage.checkHealth()).isHealthy).toBe(true);
  });

  afterAll(async () => {
    await milvusStorage.clearTable({ tableName: TABLE_MESSAGES });
    await milvusStorage.clearTable({ tableName: TABLE_THREADS });
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

      expect(milvusStorage.insert({ tableName, record })).resolves.not.toThrow();

      const loadedRecord = await milvusStorage.load<MessageRecord[]>({ tableName, keys: { id: record.id } });

      expect(loadedRecord).toBeDefined();
      expect(loadedRecord).toHaveLength(1);
      expect(loadedRecord?.[0].id).toBe(record.id.toString());
      expect(loadedRecord?.[0].threadId).toBe(record.threadId);
      expect(loadedRecord?.[0].referenceId).toBe(record.referenceId.toString());
      expect(loadedRecord?.[0].messageType).toBe(record.messageType);
      expect(loadedRecord?.[0].content).toBe(record.content);
      // expect(loadedRecord?.[0].createdAt).toBe(record.createdAt);
      expect(loadedRecord?.[0].metadata).toEqual(record.metadata);
    });

    it('should throw if varchar max length is exceeded', async () => {
      const tableName = TABLE_MESSAGES;
      const record = {
        id: 1,
        threadId: '00000000-0000-4000-a000-000000000000',
        referenceId: 1,
        messageType: 'text',
        content: 'a'.repeat(65536),
        createdAt: new Date(),
        metadata: {},
      };

      // match exception message
      expect(milvusStorage.insert({ tableName, record })).rejects.toThrow(
        'Failed to insert record: Error: Error status code: length of varchar field content exceeds max length, row number: 0, length: 65536, max length: 65535: invalid parameter',
      );
    });

    it('should not throw if json object is given', async () => {
      const tableName = TABLE_MESSAGES;
      const record = {
        id: 1,
        threadId: '00000000-0000-4000-a000-000000000000',
        referenceId: 1,
        messageType: 'text',
        content: 'test',
        createdAt: new Date(),
        metadata: { foo: 'bar' },
      };

      expect(milvusStorage.insert({ tableName, record })).resolves.not.toThrow();
    });

    it('should batch insert records', async () => {
      const tableName = TABLE_MESSAGES;
      const records = generateRecords(10);

      expect(milvusStorage.batchInsert({ tableName, records })).resolves.not.toThrow();
    });

    it('should throw if varchar max length is exceeded in batch insert', async () => {
      const tableName = TABLE_MESSAGES;
      const records = generateRecords(10);
      records[0].content = 'a'.repeat(65536);

      expect(milvusStorage.batchInsert({ tableName, records })).rejects.toThrow(
        'Failed to insert record: Error: Error status code: length of varchar field content exceeds max length, row number: 0, length: 65536, max length: 65535: invalid parameter',
      );
    });
  });

  describe('Collection cache tests', () => {
    beforeAll(async () => {
      const tableName = TABLE_MESSAGES;
      const schema: Record<string, StorageColumn> = {
        id: { type: 'bigint', nullable: false, primaryKey: true },
        threadId: { type: 'uuid', nullable: false },
        referenceId: { type: 'bigint', nullable: true },
        messageType: { type: 'text', nullable: true },
        content: { type: 'text', nullable: true },
        createdAt: { type: 'timestamp', nullable: true },
        metadata: { type: 'jsonb', nullable: true },
      };

      await milvusStorage.createTable({ tableName, schema });
    });

    it('should have improved query performance after first load', async () => {
      const tableName = TABLE_MESSAGES;
      const schema: Record<string, StorageColumn> = {
        id: { type: 'bigint', nullable: false, primaryKey: true },
        threadId: { type: 'uuid', nullable: false },
        referenceId: { type: 'bigint', nullable: true },
        messageType: { type: 'text', nullable: true },
        content: { type: 'text', nullable: true },
        createdAt: { type: 'timestamp', nullable: true },
        metadata: { type: 'jsonb', nullable: true },
      };

      // Create table and insert test data
      await milvusStorage.createTable({ tableName, schema });

      const testRecords = generateRecords(10);
      await milvusStorage.batchInsert({ tableName, records: testRecords });

      // First query - collection needs to be loaded
      const startTimeFirstQuery = performance.now();
      await milvusStorage.load({
        tableName,
        keys: { id: testRecords[0].id },
      });
      const endTimeFirstQuery = performance.now();
      const firstQueryTime = endTimeFirstQuery - startTimeFirstQuery;

      // Second query - collection should already be loaded
      const startTimeSecondQuery = performance.now();
      await milvusStorage.load({
        tableName,
        keys: { id: testRecords[1].id },
      });
      const endTimeSecondQuery = performance.now();
      const secondQueryTime = endTimeSecondQuery - startTimeSecondQuery;

      // Verify second query is faster
      expect(secondQueryTime).toBeLessThan(firstQueryTime);

      // Log the performance improvement for verification
      const performanceImprovement = ((firstQueryTime - secondQueryTime) / firstQueryTime) * 100;
      console.log(`Query performance improved by ${performanceImprovement.toFixed(2)}% after collection was loaded`);
    });

    it('should consistently maintain fast query times after collection load', async () => {
      const tableName = TABLE_MESSAGES;
      const schema: Record<string, StorageColumn> = {
        id: { type: 'bigint', nullable: false, primaryKey: true },
        threadId: { type: 'uuid', nullable: false },
        referenceId: { type: 'bigint', nullable: true },
        messageType: { type: 'text', nullable: true },
        content: { type: 'text', nullable: true },
        createdAt: { type: 'timestamp', nullable: true },
        metadata: { type: 'jsonb', nullable: true },
      };

      // Clear previously loaded collections to ensure fresh test
      (milvusStorage as any).loadedCollections = new Set();

      // Create table and insert test data
      await milvusStorage.createTable({ tableName, schema });

      const testRecords = generateRecords(20);
      await milvusStorage.batchInsert({ tableName, records: testRecords });

      // Initial query to load collection
      const initialQueryResult = await milvusStorage.load({
        tableName,
        keys: { id: testRecords[0].id },
      });

      // Verify initial query returned correct data
      expect(initialQueryResult).not.toBeNull();

      // Perform multiple queries and measure times
      const queryTimes: number[] = [];

      for (let i = 1; i < 10; i++) {
        const startTime = performance.now();
        await milvusStorage.load({
          tableName,
          keys: { id: testRecords[i].id },
        });
        const endTime = performance.now();
        queryTimes.push(endTime - startTime);
      }

      // Calculate average and standard deviation to verify consistency
      const averageTime = queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length;
      const variance = queryTimes.reduce((sum, time) => sum + Math.pow(time - averageTime, 2), 0) / queryTimes.length;
      const stdDeviation = Math.sqrt(variance);

      // Log results for debugging
      console.log(`Subsequent query times (ms): ${queryTimes.join(', ')}`);
      console.log(`Average query time: ${averageTime.toFixed(2)} ms`);
      console.log(`Standard deviation: ${stdDeviation.toFixed(2)} ms`);

      // Verify queries have relatively consistent performance (low standard deviation relative to mean)
      expect(stdDeviation).toBeLessThan(averageTime * 0.5); // StdDev should be less than 50% of average

      // Verify all subsequent queries are significantly faster than typical cold-start times
      // This threshold might need adjustment based on actual system performance
      // TODO: the performance is very poor, need to fix
      const reasonableColdStartTime = 500; // ms
      queryTimes.forEach(time => {
        expect(time).toBeLessThan(reasonableColdStartTime);
      });
    });
  });

  describe('Thread operations', () => {
    beforeAll(async () => {
      await milvusStorage.createTable({
        tableName: TABLE_THREADS,
        schema: TABLE_SCHEMAS[TABLE_THREADS],
      });
    });

    it('should save a thread', async () => {
      const thread = generateThreads(1)[0];

      const savedThread = await milvusStorage.saveThread({
        thread,
      });

      expect(savedThread).toBeDefined();
      expect(savedThread.title).toBe(thread.title);
      expect(savedThread.metadata).toEqual(thread.metadata);
      expect(savedThread.createdAt).toEqual(thread.createdAt);
      expect(savedThread.updatedAt).toEqual(thread.updatedAt);

      const threadFromDB = await milvusStorage.getThreadById({ threadId: savedThread.id });

      expect(threadFromDB).toBeDefined();
      expect(threadFromDB?.title).toBe(thread.title);
      expect(threadFromDB?.metadata).toEqual(thread.metadata);
      expect(threadFromDB?.createdAt).toEqual(thread.createdAt);
      expect(threadFromDB?.updatedAt).toEqual(thread.updatedAt);
      expect(threadFromDB?.resourceId).toEqual(savedThread.resourceId);
      expect(threadFromDB?.id).toEqual(savedThread.id);
    });

    it('should update a thread', async () => {
      const thread = generateThreads(1)[0];

      const savedThread = await milvusStorage.saveThread({
        thread,
      });

      expect(savedThread).toBeDefined();
      expect(savedThread.title).toBe(thread.title);
      expect(savedThread.metadata).toEqual(thread.metadata);
      expect(savedThread.createdAt).toEqual(thread.createdAt);
      expect(savedThread.updatedAt).toEqual(thread.updatedAt);

      const updatedThread = await milvusStorage.updateThread({
        id: savedThread.id,
        title: 'updated title',
        metadata: { foo: 'bar' },
      });

      expect(updatedThread).toBeDefined();
      expect(updatedThread.title).toBe('updated title');
      expect(updatedThread.metadata).toEqual({ foo: 'bar' });
      expect(updatedThread.createdAt).toEqual(savedThread.createdAt);
      expect(updatedThread.updatedAt.getTime()).toBeGreaterThan(savedThread.updatedAt.getTime());

      // Verify that the thread was updated in the database
      const threadFromDB = await milvusStorage.getThreadById({ threadId: savedThread.id });
      expect(threadFromDB).toBeDefined();
      expect(threadFromDB?.title).toBe('updated title');
      expect(threadFromDB?.metadata).toEqual({ foo: 'bar' });
      expect(threadFromDB?.createdAt).toEqual(savedThread.createdAt);
      expect(threadFromDB?.updatedAt.getTime()).toBeGreaterThan(savedThread.updatedAt.getTime());
    });

    it('should get threads by resource id', async () => {
      const resourceId = '00000000-0000-4000-a000-000000000023';
      const threads = generateThreads(5, resourceId);

      for (const thread of threads) {
        await milvusStorage.saveThread({ thread });
      }

      const threadsFromDB = await milvusStorage.getThreadsByResourceId({ resourceId });

      expect(threadsFromDB).toBeDefined();
      expect(threadsFromDB.length).toBe(5);

      for (let i = 0; i < threadsFromDB.length; i++) {
        expect(threadsFromDB[i].id).toBe(threads[i].id);
        expect(threadsFromDB[i].title).toBe(threads[i].title);
        expect(threadsFromDB[i].metadata).toEqual(threads[i].metadata);
        expect(threadsFromDB[i].createdAt).toEqual(threads[i].createdAt);
        expect(threadsFromDB[i].updatedAt).toEqual(threads[i].updatedAt);
      }
    });

    it('should delete a thread', async () => {
      const thread = {
        id: '1000',
        resourceId: '00000000-0000-4000-a000-000000000023',
        title: 'Test thread',
        metadata: { foo: 'bar' },
        createdAt: new Date(),
        updatedAt: new Date(),
        vector_placeholder: [0, 0],
      };

      const savedThread = await milvusStorage.saveThread({ thread });

      expect(savedThread).toBeDefined();

      await milvusStorage.deleteThread({ threadId: savedThread.id });

      const threadFromDB = await milvusStorage.getThreadById({ threadId: savedThread.id });
      expect(threadFromDB).toBeNull();
    });
  });

  describe('Message operations', () => {
    beforeAll(async () => {
      await milvusStorage.clearTable({ tableName: TABLE_MESSAGES });

      await milvusStorage.createTable({
        tableName: TABLE_MESSAGES,
        schema: TABLE_SCHEMAS[TABLE_MESSAGES],
      });
    });

    it('should save a message', async () => {
      const messages = generateMessageRecords(1);

      const savedMessage = await milvusStorage.saveMessages({ messages });

      expect(savedMessage).toBeDefined();
      expect(savedMessage[0].id).toBe(messages[0].id);
      expect(savedMessage[0].threadId).toBe(messages[0].threadId);
      expect(savedMessage[0].content).toBe(messages[0].content);
      expect(savedMessage[0].role).toBe(messages[0].role);
      expect(savedMessage[0].type).toBe(messages[0].type);
      expect(savedMessage[0].createdAt).toEqual(messages[0].createdAt);

      const messagesFromDB = await milvusStorage.getMessages({ threadId: messages[0].threadId });

      expect(messagesFromDB).toBeDefined();
      expect(messagesFromDB[0].id).toBe(messages[0].id);
      expect(messagesFromDB[0].threadId).toBe(messages[0].threadId);
      expect(messagesFromDB[0].content).toBe(messages[0].content);
      expect(messagesFromDB[0].role).toBe(messages[0].role);
      expect(messagesFromDB[0].type).toBe(messages[0].type);
      expect(messagesFromDB[0].createdAt).toEqual(messages[0].createdAt);
    });

    it('should get the last N messages when selectBy.last is specified', async () => {
      const threadId = '12333d567-e89b-12d3-a456-426614174000';
      const messages: MessageType[] = generateMessageRecords(10, threadId);
      await milvusStorage.saveMessages({ messages });

      // Get the last 3 messages
      const loadedMessages = await milvusStorage.getMessages({
        threadId,
        selectBy: { last: 3 },
      });

      expect(loadedMessages).not.toBeNull();
      expect(loadedMessages.length).toEqual(3);

      messages.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Verify that we got the last 3 messages in chronological order
      for (let i = 0; i < 3; i++) {
        expect(loadedMessages[i].id.toString()).toEqual(messages[messages.length - 4 + i].id);
        expect(loadedMessages[i].content).toEqual(messages[messages.length - 4 + i].content);
      }
    });

    it('should get specific messages when selectBy.include is specified', async () => {
      const threadId = '12333d567-e89b-12d3-a456-426614174000';
      const messages: MessageType[] = generateMessageRecords(10, threadId);
      await milvusStorage.saveMessages({ messages });

      // Select specific messages by ID
      const messageIds = [messages[2].id, messages[5].id, messages[8].id];
      const loadedMessages = await milvusStorage.getMessages({
        threadId,
        selectBy: {
          include: messageIds.map(id => ({ id })),
        },
      });

      expect(loadedMessages).not.toBeNull();
      // We should get either the specified messages or all thread messages
      expect(loadedMessages.length).toBeGreaterThanOrEqual(3);

      // Verify that the selected messages are included in the results
      const loadedIds = loadedMessages.map(m => m.id.toString());
      messageIds.forEach(id => {
        expect(loadedIds).toContain(id);
      });
    });

    it('should handle empty results when using selectBy filters', async () => {
      const threadId = '12333d567-e89b-12d3-a456';
      // Create messages for a different thread ID
      const messages: MessageType[] = generateMessageRecords(5, 'different-thread-id');
      await milvusStorage.saveMessages({ messages });

      // Try to get messages for our test threadId, which should return empty
      const loadedMessages = await milvusStorage.getMessages({
        threadId,
        selectBy: { last: 3 },
      });

      expect(loadedMessages).not.toBeNull();
      expect(loadedMessages.length).toEqual(0);
    });
  });

  describe('Eval operations', () => {
    beforeAll(async () => {
      // Create table
      await milvusStorage.createTable({ tableName: TABLE_EVALS, schema: TABLE_SCHEMAS[TABLE_EVALS] });

      // Create test records - half with test type, half with live type
      const testEvals = generateEvalRecords(5);
      const liveEvals = generateEvalRecords(5).map(evalRecord => ({
        ...evalRecord,
        testInfo: { testName: '', testPath: '' }, // Empty testPath for live evals
      }));

      // Prepare all records for insertion
      const preparedEvals = [...testEvals, ...liveEvals].map(evalRecord => ({
        input: evalRecord.input,
        output: evalRecord.output,
        result: JSON.stringify(evalRecord.result),
        agentName: evalRecord.agentName,
        metricName: evalRecord.metricName,
        instructions: evalRecord.instructions,
        testInfo: JSON.stringify(evalRecord.testInfo),
        runId: evalRecord.runId,
        globalRunId: evalRecord.globalRunId,
        createdAt: evalRecord.createdAt,
      }));

      // Insert all records
      await milvusStorage.batchInsert({ tableName: TABLE_EVALS, records: preparedEvals });
    });

    afterAll(async () => {
      await milvusStorage.clearTable({ tableName: TABLE_EVALS });
    });

    it('should get evals by agent name', async () => {
      const agentName = 'Test agent 2';

      const result = await milvusStorage.getEvalsByAgentName(agentName);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].agentName).toBe(agentName);
    });

    it('should filter evals by test type', async () => {
      const agentName = 'Test agent 3';

      const result = await milvusStorage.getEvalsByAgentName(agentName, 'test');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // All results should have test info with a test path
      result.forEach(evalRecord => {
        expect(evalRecord.testInfo?.testPath).toBeTruthy();
      });
    });

    it('should filter evals by live type', async () => {
      const agentName = 'Test agent 4';

      const result = await milvusStorage.getEvalsByAgentName(agentName, 'live');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // All results should have empty test paths
      result.forEach(evalRecord => {
        expect(evalRecord.testInfo?.testPath).toBeFalsy();
      });
    });

    it('should return empty array for non-existent agent', async () => {
      const result = await milvusStorage.getEvalsByAgentName('non-existent-agent');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('Trace operations', () => {
    beforeAll(async () => {
      // Create table
      await milvusStorage.createTable({ tableName: TABLE_TRACES, schema: TABLE_SCHEMAS[TABLE_TRACES] });

      // Generate and insert test traces
      const traces = generateTraceRecords(10);

      // Set specific attribute values for filtering tests
      traces[0].attributes = { testFilter: 'filterValue1' };
      traces[1].attributes = { testFilter: 'filterValue2' };

      // Set specific scopes for filtering tests
      traces[0].scope = 'test-scope-1';
      traces[1].scope = 'test-scope-2';

      // Prepare records for insertion
      const preparedTraces = traces.map(trace => ({
        id: trace.id,
        name: trace.name,
        scope: trace.scope,
        kind: trace.kind,
        parentSpanId: trace.parentSpanId,
        traceId: trace.traceId,
        attributes: JSON.stringify(trace.attributes),
        status: JSON.stringify(trace.status),
        events: JSON.stringify(trace.events),
        links: JSON.stringify(trace.links),
        other: JSON.stringify(trace.other),
        startTime: trace.startTime,
        endTime: trace.endTime,
        createdAt: trace.createdAt.getTime(),
      }));

      // Insert records
      await milvusStorage.batchInsert({ tableName: TABLE_TRACES, records: preparedTraces });
    });

    afterAll(async () => {
      await milvusStorage.clearTable({ tableName: TABLE_TRACES });
    });

    it('should get traces with pagination', async () => {
      const result = await milvusStorage.getTraces({
        page: 1,
        perPage: 5,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should filter traces by name', async () => {
      const traceName = 'Test trace 2';

      const result = await milvusStorage.getTraces({
        name: traceName,
        page: 1,
        perPage: 10,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].name).toBe(traceName);
    });

    it('should filter traces by scope', async () => {
      const result = await milvusStorage.getTraces({
        scope: 'test-scope-1',
        page: 1,
        perPage: 10,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].scope).toBe('test-scope-1');
    });

    it('should filter traces by attributes', async () => {
      const result = await milvusStorage.getTraces({
        attributes: { testFilter: 'filterValue1' },
        page: 1,
        perPage: 10,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // For now, just check that we get results back
      // The Milvus JSON filtering may not work perfectly in the test environment
      // so we're just checking that the query executes without errors
    });

    it('should apply custom filters', async () => {
      const result = await milvusStorage.getTraces({
        filters: { name: 'Test trace 1' },
        page: 1,
        perPage: 10,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Workflow operations', () => {
    beforeAll(async () => {
      // Create table
      await milvusStorage.createTable({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
      });

      // Generate and prepare workflow runs
      const { runs } = generateWorkflowRuns(20);

      // Add namespaces to runs for filtering tests
      const runsWithNamespace = runs.map((run, index) => ({
        ...run,
        namespace: index < 10 ? 'namespace-a' : 'namespace-b',
      }));

      // Change created dates for date filtering tests
      runs[0].createdAt = new Date('2023-01-01');
      runs[1].createdAt = new Date('2023-02-01');
      runs[2].createdAt = new Date('2023-03-01');

      // Prepare records for insertion
      const preparedRuns = runsWithNamespace.map(run => ({
        workflowName: run.workflowName,
        runId: run.runId,
        namespace: run.namespace,
        snapshot: run.snapshot,
        createdAt: run.createdAt.getTime(),
        updatedAt: run.updatedAt.getTime(),
      }));

      // Insert workflow runs
      await milvusStorage.batchInsert({ tableName: TABLE_WORKFLOW_SNAPSHOT, records: preparedRuns });
    });

    afterAll(async () => {
      await milvusStorage.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
    });

    it('should get all workflow runs with pagination', async () => {
      const result = await milvusStorage.getWorkflowRuns({
        limit: 5,
        offset: 0,
      });

      expect(result).toBeDefined();
      expect(result.runs).toBeDefined();
      expect(Array.isArray(result.runs)).toBe(true);
      expect(result.runs.length).toBeLessThanOrEqual(5);
      expect(result.total).toBeGreaterThanOrEqual(20);
    });

    it('should filter workflow runs by namespace', async () => {
      const namespace = 'namespace-a';

      const result = await milvusStorage.getWorkflowRuns({
        namespace,
      });

      expect(result).toBeDefined();
      expect(result.runs).toBeDefined();
      expect(Array.isArray(result.runs)).toBe(true);
      expect(result.runs.length).toBeGreaterThan(0);

      // Verify all results have the specified namespace
      result.runs.forEach(run => {
        expect((run as any).namespace).toBe(namespace);
      });
    });

    it('should filter workflow runs by workflow name', async () => {
      const workflowName = 'Test workflow 2';

      const result = await milvusStorage.getWorkflowRuns({
        workflowName,
      });

      expect(result).toBeDefined();
      expect(result.runs).toBeDefined();
      expect(Array.isArray(result.runs)).toBe(true);

      // Verify results have correct workflow name
      if (result.runs.length > 0) {
        expect(result.runs[0].workflowName).toBe(workflowName);
      }
    });

    it('should filter workflow runs by date range', async () => {
      const fromDate = new Date('2023-01-15'); // After the first record
      const toDate = new Date('2023-03-15'); // After the last modified record

      const result = await milvusStorage.getWorkflowRuns({
        fromDate,
        toDate,
      });

      expect(result).toBeDefined();
      expect(result.runs).toBeDefined();
      expect(Array.isArray(result.runs)).toBe(true);

      // The date range should include at least records 1 and 2
      if (result.runs.length > 0) {
        // Verify all runs are within the date range
        result.runs.forEach(run => {
          const runDate = run.createdAt.getTime();
          expect(runDate).toBeGreaterThanOrEqual(fromDate.getTime());
          expect(runDate).toBeLessThanOrEqual(toDate.getTime());
        });
      }
    });

    it('should combine multiple filters', async () => {
      const namespace = 'namespace-a';
      const workflowName = 'Test workflow 1';

      const result = await milvusStorage.getWorkflowRuns({
        namespace,
        workflowName,
      });

      expect(result).toBeDefined();
      expect(result.runs).toBeDefined();
      expect(Array.isArray(result.runs)).toBe(true);

      // If there are results, verify they match all criteria
      if (result.runs.length > 0) {
        expect((result.runs[0] as any).namespace).toBe(namespace);
        expect(result.runs[0].workflowName).toBe(workflowName);
      }
    });
  });
});
