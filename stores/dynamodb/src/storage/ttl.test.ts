import { spawn } from 'node:child_process';
import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ListTablesCommand,
  waitUntilTableExists,
  waitUntilTableNotExists,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

import { DynamoDBStore } from '..';

const TEST_TABLE_NAME = 'mastra-ttl-test-table';
const LOCAL_ENDPOINT = 'http://localhost:8000';
const LOCAL_REGION = 'local-test';

let setupClient: DynamoDBClient;
let documentClient: DynamoDBDocumentClient;
let dynamodbProcess: ReturnType<typeof spawn>;

// Helper function to wait for DynamoDB Local
async function waitForDynamoDBLocal(client: DynamoDBClient, timeoutMs = 90000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      await client.send(new ListTablesCommand({}));
      return;
    } catch (e: unknown) {
      let errorName: string | undefined;
      if (e instanceof Error) {
        errorName = e.name;
      }
      if (errorName === 'ECONNREFUSED' || errorName === 'TimeoutError' || errorName === 'ERR_INVALID_PROTOCOL') {
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        throw e;
      }
    }
  }
  throw new Error(`DynamoDB Local did not become ready within ${timeoutMs}ms.`);
}

describe('DynamoDB TTL Support', () => {
  beforeAll(async () => {
    setupClient = new DynamoDBClient({
      endpoint: LOCAL_ENDPOINT,
      region: LOCAL_REGION,
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
      maxAttempts: 5,
    });

    documentClient = DynamoDBDocumentClient.from(setupClient, {
      marshallOptions: { removeUndefinedValues: true },
    });

    // Start DynamoDB Local using docker-compose
    dynamodbProcess = spawn('docker-compose', ['up', '-d'], {
      cwd: __dirname,
      stdio: 'pipe',
    });
    dynamodbProcess.stderr?.on('data', data => console.error(`docker-compose stderr: ${data}`));

    await new Promise(resolve => setTimeout(resolve, 3000));
    await waitForDynamoDBLocal(setupClient);

    // Delete table if exists
    try {
      await setupClient.send(new DescribeTableCommand({ TableName: TEST_TABLE_NAME }));
      await setupClient.send(new DeleteTableCommand({ TableName: TEST_TABLE_NAME }));
      await waitUntilTableNotExists({ client: setupClient, maxWaitTime: 60 }, { TableName: TEST_TABLE_NAME });
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'ResourceNotFoundException') {
        throw e;
      }
    }

    // Create test table
    const createTableCommand = new CreateTableCommand({
      TableName: TEST_TABLE_NAME,
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
        { AttributeName: 'gsi1pk', AttributeType: 'S' },
        { AttributeName: 'gsi1sk', AttributeType: 'S' },
        { AttributeName: 'gsi2pk', AttributeType: 'S' },
        { AttributeName: 'gsi2sk', AttributeType: 'S' },
        { AttributeName: 'gsi3pk', AttributeType: 'S' },
        { AttributeName: 'gsi3sk', AttributeType: 'S' },
        { AttributeName: 'gsi4pk', AttributeType: 'S' },
        { AttributeName: 'gsi4sk', AttributeType: 'S' },
        { AttributeName: 'gsi5pk', AttributeType: 'S' },
        { AttributeName: 'gsi5sk', AttributeType: 'S' },
        { AttributeName: 'gsi6pk', AttributeType: 'S' },
        { AttributeName: 'gsi6sk', AttributeType: 'S' },
        { AttributeName: 'gsi7pk', AttributeType: 'S' },
        { AttributeName: 'gsi7sk', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'gsi1',
          KeySchema: [
            { AttributeName: 'gsi1pk', KeyType: 'HASH' },
            { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'gsi2',
          KeySchema: [
            { AttributeName: 'gsi2pk', KeyType: 'HASH' },
            { AttributeName: 'gsi2sk', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'gsi3',
          KeySchema: [
            { AttributeName: 'gsi3pk', KeyType: 'HASH' },
            { AttributeName: 'gsi3sk', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'gsi4',
          KeySchema: [
            { AttributeName: 'gsi4pk', KeyType: 'HASH' },
            { AttributeName: 'gsi4sk', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'gsi5',
          KeySchema: [
            { AttributeName: 'gsi5pk', KeyType: 'HASH' },
            { AttributeName: 'gsi5sk', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'gsi6',
          KeySchema: [
            { AttributeName: 'gsi6pk', KeyType: 'HASH' },
            { AttributeName: 'gsi6sk', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'gsi7',
          KeySchema: [
            { AttributeName: 'gsi7pk', KeyType: 'HASH' },
            { AttributeName: 'gsi7sk', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    });
    await setupClient.send(createTableCommand);
    await waitUntilTableExists({ client: setupClient, maxWaitTime: 60 }, { TableName: TEST_TABLE_NAME });
  }, 90000);

  afterAll(async () => {
    // Clean up table
    try {
      await setupClient.send(new DeleteTableCommand({ TableName: TEST_TABLE_NAME }));
    } catch {
      // Ignore errors on cleanup
    }
  });

  describe('TTL Configuration', () => {
    it('should accept TTL configuration in DynamoDBStoreConfig', () => {
      // This test verifies that the TTL config is accepted in the store configuration
      const store = new DynamoDBStore({
        name: 'ttl-test-store',
        config: {
          id: 'ttl-test',
          tableName: TEST_TABLE_NAME,
          endpoint: LOCAL_ENDPOINT,
          region: LOCAL_REGION,
          credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
          ttl: {
            thread: {
              enabled: true,
              defaultTtlSeconds: 30 * 24 * 60 * 60, // 30 days
            },
            message: {
              enabled: true,
              defaultTtlSeconds: 7 * 24 * 60 * 60, // 7 days
            },
          },
        },
      });

      // Verify the store was created (basic sanity check)
      expect(store).toBeDefined();
      expect(store.name).toBe('ttl-test-store');
    });

    it('should set TTL attribute on saved threads when TTL is configured', async () => {
      // Create store with TTL configuration
      const store = new DynamoDBStore({
        name: 'ttl-thread-test',
        config: {
          id: 'ttl-test',
          tableName: TEST_TABLE_NAME,
          endpoint: LOCAL_ENDPOINT,
          region: LOCAL_REGION,
          credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
          ttl: {
            thread: {
              enabled: true,
              defaultTtlSeconds: 30 * 24 * 60 * 60, // 30 days
            },
          },
        },
      });

      const memoryStore = await store.getStore('memory');
      expect(memoryStore).toBeDefined();

      const threadId = `ttl-test-thread-${Date.now()}`;
      const thread = {
        id: threadId,
        resourceId: 'test-resource',
        title: 'TTL Test Thread',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await memoryStore!.saveThread({ thread });

      // Verify the thread was saved with TTL attribute
      // Use scan with filter to find the item by id (ElectroDB uses complex key format)
      const result = await documentClient.send(
        new ScanCommand({
          TableName: TEST_TABLE_NAME,
          FilterExpression: 'id = :id AND #entity = :entity',
          ExpressionAttributeNames: { '#entity': 'entity' },
          ExpressionAttributeValues: {
            ':id': threadId,
            ':entity': 'thread',
          },
        }),
      );

      expect(result.Items).toBeDefined();
      expect(result.Items!.length).toBe(1);
      const item = result.Items![0];

      // The ttl attribute should be set to a Unix timestamp (epoch seconds)
      expect(item?.ttl).toBeDefined();
      expect(typeof item?.ttl).toBe('number');

      // TTL should be approximately 30 days from now (with some tolerance)
      const expectedTtl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      const tolerance = 60; // 1 minute tolerance
      expect(item?.ttl).toBeGreaterThan(expectedTtl - tolerance);
      expect(item?.ttl).toBeLessThan(expectedTtl + tolerance);

      // Clean up
      await memoryStore!.deleteThread({ threadId });
    });

    it('should set TTL attribute on saved messages when TTL is configured', async () => {
      // Create store with TTL configuration for messages
      const store = new DynamoDBStore({
        name: 'ttl-message-test',
        config: {
          id: 'ttl-test',
          tableName: TEST_TABLE_NAME,
          endpoint: LOCAL_ENDPOINT,
          region: LOCAL_REGION,
          credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
          ttl: {
            message: {
              enabled: true,
              defaultTtlSeconds: 7 * 24 * 60 * 60, // 7 days
            },
          },
        },
      });

      const memoryStore = await store.getStore('memory');
      expect(memoryStore).toBeDefined();

      // First create a thread (required for messages)
      const threadId = `ttl-test-thread-${Date.now()}`;
      const thread = {
        id: threadId,
        resourceId: 'test-resource',
        title: 'TTL Test Thread',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await memoryStore!.saveThread({ thread });

      // Save a message
      const messageId = `ttl-test-message-${Date.now()}`;
      const messages = [
        {
          id: messageId,
          threadId,
          resourceId: 'test-resource',
          role: 'user' as const,
          type: 'v2' as const,
          content: { content: 'Test message', metadata: {} },
          createdAt: new Date(),
        },
      ];

      await memoryStore!.saveMessages({ messages });

      // Verify the message was saved with TTL attribute
      const result = await documentClient.send(
        new ScanCommand({
          TableName: TEST_TABLE_NAME,
          FilterExpression: 'id = :id AND #entity = :entity',
          ExpressionAttributeNames: { '#entity': 'entity' },
          ExpressionAttributeValues: {
            ':id': messageId,
            ':entity': 'message',
          },
        }),
      );

      expect(result.Items).toBeDefined();
      expect(result.Items!.length).toBe(1);
      const item = result.Items![0];

      expect(item?.ttl).toBeDefined();
      expect(typeof item?.ttl).toBe('number');

      // TTL should be approximately 7 days from now
      const expectedTtl = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
      const tolerance = 60;
      expect(item?.ttl).toBeGreaterThan(expectedTtl - tolerance);
      expect(item?.ttl).toBeLessThan(expectedTtl + tolerance);

      // Clean up
      await memoryStore!.deleteThread({ threadId });
    });

    it('should NOT set TTL attribute when TTL is disabled or not configured', async () => {
      // Create store without TTL configuration
      const store = new DynamoDBStore({
        name: 'no-ttl-test',
        config: {
          id: 'no-ttl-test',
          tableName: TEST_TABLE_NAME,
          endpoint: LOCAL_ENDPOINT,
          region: LOCAL_REGION,
          credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
          // No TTL config
        },
      });

      const memoryStore = await store.getStore('memory');
      expect(memoryStore).toBeDefined();

      const threadId = `no-ttl-test-thread-${Date.now()}`;
      const thread = {
        id: threadId,
        resourceId: 'test-resource',
        title: 'No TTL Test Thread',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await memoryStore!.saveThread({ thread });

      // Verify the thread was saved WITHOUT TTL attribute
      const result = await documentClient.send(
        new ScanCommand({
          TableName: TEST_TABLE_NAME,
          FilterExpression: 'id = :id AND #entity = :entity',
          ExpressionAttributeNames: { '#entity': 'entity' },
          ExpressionAttributeValues: {
            ':id': threadId,
            ':entity': 'thread',
          },
        }),
      );

      expect(result.Items).toBeDefined();
      expect(result.Items!.length).toBe(1);
      const item = result.Items![0];

      // The ttl attribute should NOT be set
      expect(item?.ttl).toBeUndefined();

      // Clean up
      await memoryStore!.deleteThread({ threadId });
    });

    it('should support custom TTL attribute names', async () => {
      // Create store with custom TTL attribute name
      const store = new DynamoDBStore({
        name: 'custom-ttl-attr-test',
        config: {
          id: 'ttl-test',
          tableName: TEST_TABLE_NAME,
          endpoint: LOCAL_ENDPOINT,
          region: LOCAL_REGION,
          credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
          ttl: {
            thread: {
              enabled: true,
              attributeName: 'expiresAt', // Custom attribute name
              defaultTtlSeconds: 30 * 24 * 60 * 60,
            },
          },
        },
      });

      const memoryStore = await store.getStore('memory');
      expect(memoryStore).toBeDefined();

      const threadId = `custom-ttl-attr-thread-${Date.now()}`;
      const thread = {
        id: threadId,
        resourceId: 'test-resource',
        title: 'Custom TTL Attr Test Thread',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await memoryStore!.saveThread({ thread });

      // Verify the thread was saved with the custom TTL attribute name
      const result = await documentClient.send(
        new ScanCommand({
          TableName: TEST_TABLE_NAME,
          FilterExpression: 'id = :id AND #entity = :entity',
          ExpressionAttributeNames: { '#entity': 'entity' },
          ExpressionAttributeValues: {
            ':id': threadId,
            ':entity': 'thread',
          },
        }),
      );

      expect(result.Items).toBeDefined();
      expect(result.Items!.length).toBe(1);
      const item = result.Items![0];

      // The expiresAt attribute should be set (not ttl)
      expect(item?.expiresAt).toBeDefined();
      expect(typeof item?.expiresAt).toBe('number');

      // Clean up
      await memoryStore!.deleteThread({ threadId });
    });

    it('should allow per-entity TTL configuration', async () => {
      // Create store with different TTL for different entities
      const store = new DynamoDBStore({
        name: 'per-entity-ttl-test',
        config: {
          id: 'ttl-test',
          tableName: TEST_TABLE_NAME,
          endpoint: LOCAL_ENDPOINT,
          region: LOCAL_REGION,
          credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
          ttl: {
            thread: {
              enabled: true,
              defaultTtlSeconds: 90 * 24 * 60 * 60, // 90 days for threads
            },
            message: {
              enabled: true,
              defaultTtlSeconds: 30 * 24 * 60 * 60, // 30 days for messages
            },
            trace: {
              enabled: true,
              defaultTtlSeconds: 7 * 24 * 60 * 60, // 7 days for traces
            },
            workflow_snapshot: {
              enabled: false, // Disabled for workflow snapshots
            },
          },
        },
      });

      expect(store).toBeDefined();
      // Store should be created without errors with per-entity config
    });
  });
});
