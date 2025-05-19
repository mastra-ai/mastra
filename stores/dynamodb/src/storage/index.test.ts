import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import {
  BatchWriteItemCommand,
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ListTablesCommand,
  ScanCommand,
  waitUntilTableExists,
  waitUntilTableNotExists,
} from '@aws-sdk/client-dynamodb';
import type { MessageType, StorageThreadType, WorkflowRun, WorkflowRunState } from '@mastra/core';
import { TABLE_EVALS, TABLE_THREADS, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { DynamoDBStore } from '..';

const TEST_TABLE_NAME = 'mastra-single-table-test'; // Define the single table name
const LOCAL_ENDPOINT = 'http://localhost:8000';
const LOCAL_REGION = 'local-test'; // Use a distinct region for local testing

// Docker process handle
let dynamodbProcess: ReturnType<typeof spawn>;

// AWS SDK Client for setup/teardown
let setupClient: DynamoDBClient;

// Function to wait for DynamoDB Local to be ready
async function waitForDynamoDBLocal(client: DynamoDBClient, timeoutMs = 90000): Promise<void> {
  const startTime = Date.now();
  console.log(`Waiting up to ${timeoutMs / 1000}s for DynamoDB Local...`);
  while (Date.now() - startTime < timeoutMs) {
    try {
      await client.send(new ListTablesCommand({}));
      console.log('DynamoDB Local is ready.');
      return; // Success
    } catch (e: unknown) {
      let errorName: string | undefined;

      if (e instanceof Error) {
        errorName = e.name;
      } else if (
        typeof e === 'object' &&
        e !== null &&
        'name' in e &&
        typeof (e as { name: unknown }).name === 'string'
      ) {
        errorName = (e as { name: string }).name;
      }

      if (errorName === 'ECONNREFUSED' || errorName === 'TimeoutError' || errorName === 'ERR_INVALID_PROTOCOL') {
        // Expected errors while starting
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait before retrying
      } else {
        console.error('Unexpected error waiting for DynamoDB Local:', e);
        throw e; // Rethrow unexpected errors
      }
    }
  }
  throw new Error(`DynamoDB Local did not become ready within ${timeoutMs}ms.`);
}

// Function to clear all items from the single table
async function clearSingleTable(client: DynamoDBClient, tableName: string) {
  let ExclusiveStartKey: Record<string, any> | undefined;
  let items: Record<string, any>[] = [];

  // Scan all items (handling pagination)
  do {
    const scanOutput = await client.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey,
        ProjectionExpression: 'pk, sk', // Only need keys for deletion
      }),
    );
    items = items.concat(scanOutput.Items || []);
    ExclusiveStartKey = scanOutput.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  if (items.length === 0) {
    return; // Nothing to delete
  }

  // Batch delete items (handling DynamoDB 25 item limit per batch)
  const deleteRequests = items.map(item => ({
    DeleteRequest: {
      Key: { pk: item.pk, sk: item.sk },
    },
  }));

  for (let i = 0; i < deleteRequests.length; i += 25) {
    const batch = deleteRequests.slice(i, i + 25);
    const command = new BatchWriteItemCommand({
      RequestItems: {
        [tableName]: batch,
      },
    });
    // Handle unprocessed items if necessary (though less likely with local)
    let result = await client.send(command);
    while (
      result.UnprocessedItems &&
      result.UnprocessedItems[tableName] &&
      result.UnprocessedItems[tableName].length > 0
    ) {
      console.warn(`Retrying ${result.UnprocessedItems[tableName].length} unprocessed delete items...`);
      await new Promise(res => setTimeout(res, 200)); // Simple backoff
      const retryCommand = new BatchWriteItemCommand({ RequestItems: result.UnprocessedItems });
      result = await client.send(retryCommand);
    }
  }
  // console.log(`Cleared ${items.length} items from ${tableName}`);
}

// Start DynamoDB Local container and create table
beforeAll(async () => {
  // Initialize client for setup
  setupClient = new DynamoDBClient({
    endpoint: LOCAL_ENDPOINT,
    region: LOCAL_REGION,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    // Increase timeout for setup operations
    requestHandler: { requestTimeout: 10000 },
    // Add retries for setup commands
    maxAttempts: 5,
  });

  // Start DynamoDB Local using docker-compose
  console.log('Starting DynamoDB Local container...');
  dynamodbProcess = spawn('docker-compose', ['up', '-d'], {
    cwd: __dirname, // Ensure docker-compose runs from the test file directory if needed
    stdio: 'pipe', // Use pipe to potentially capture output if needed
  });
  dynamodbProcess.stderr?.on('data', data => console.error(`docker-compose stderr: ${data}`));
  dynamodbProcess.on('error', err => console.error('Failed to start docker-compose:', err));

  // Add a short fixed delay to allow the container process to stabilize before polling
  console.log('Waiting a few seconds for container process to stabilize...');
  await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second delay

  // Wait for DynamoDB to be ready
  try {
    await waitForDynamoDBLocal(setupClient);
  } catch (e) {
    console.error('Failed to connect to DynamoDB Local after startup.', e);
    // Attempt to stop container on failure
    spawn('docker-compose', ['down'], { cwd: __dirname, stdio: 'pipe' });
    throw e; // Re-throw error to fail the test suite
  }

  // Delete the table if it exists from a previous run
  try {
    console.log(`Checking if table ${TEST_TABLE_NAME} exists...`);
    await setupClient.send(new DescribeTableCommand({ TableName: TEST_TABLE_NAME }));
    console.log(`Table ${TEST_TABLE_NAME} exists, attempting deletion...`);
    await setupClient.send(new DeleteTableCommand({ TableName: TEST_TABLE_NAME }));
    console.log(`Waiting for table ${TEST_TABLE_NAME} to be deleted...`);
    await waitUntilTableNotExists({ client: setupClient, maxWaitTime: 60 }, { TableName: TEST_TABLE_NAME });
    console.log(`Table ${TEST_TABLE_NAME} deleted.`);
  } catch (e: unknown) {
    let errorName: string | undefined;

    if (e instanceof Error) {
      errorName = e.name;
    } else if (
      typeof e === 'object' &&
      e !== null &&
      'name' in e &&
      typeof (e as { name: unknown }).name === 'string'
    ) {
      errorName = (e as { name: string }).name;
    }

    if (errorName === 'ResourceNotFoundException') {
      console.log(`Table ${TEST_TABLE_NAME} does not exist, proceeding.`);
    } else {
      console.error(`Error deleting table ${TEST_TABLE_NAME}:`, e);
      throw e; // Rethrow other errors
    }
  }

  // Create the single table with the correct schema
  console.log(`Creating table ${TEST_TABLE_NAME}...`);
  try {
    const createTableCommand = new CreateTableCommand({
      TableName: TEST_TABLE_NAME,
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
        { AttributeName: 'gsi1pk', AttributeType: 'S' },
        { AttributeName: 'gsi1sk', AttributeType: 'S' },
        { AttributeName: 'gsi2pk', AttributeType: 'S' },
        { AttributeName: 'gsi2sk', AttributeType: 'S' },
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
      ],
      BillingMode: 'PAY_PER_REQUEST', // Use PAY_PER_REQUEST for local testing ease
    });
    await setupClient.send(createTableCommand);
    console.log(`Waiting for table ${TEST_TABLE_NAME} to become active...`);
    await waitUntilTableExists({ client: setupClient, maxWaitTime: 60 }, { TableName: TEST_TABLE_NAME });
    console.log(`Table ${TEST_TABLE_NAME} created successfully.`);
  } catch (e) {
    console.error(`Failed to create table ${TEST_TABLE_NAME}:`, e);
    throw e;
  }
}, 60000); // Increase timeout for beforeAll to accommodate Docker startup and table creation

// Stop DynamoDB Local container
afterAll(async () => {
  console.log('Stopping DynamoDB Local container...');
  // Optionally delete the table
  // try {
  //   await setupClient.send(new DeleteTableCommand({ TableName: TEST_TABLE_NAME }));
  //   await waitUntilTableNotExists({ client: setupClient, maxWaitTime: 60 }, { TableName: TEST_TABLE_NAME });
  //   console.log(`Test table ${TEST_TABLE_NAME} deleted.`);
  // } catch (error) {
  //   console.error(`Error deleting test table ${TEST_TABLE_NAME}:`, error);
  // }

  if (setupClient) {
    setupClient.destroy();
  }

  const stopProcess = spawn('docker-compose', ['down', '--volumes'], {
    // Remove volumes too
    cwd: __dirname,
    stdio: 'pipe',
  });
  stopProcess.stderr?.on('data', data => console.error(`docker-compose down stderr: ${data}`));
  stopProcess.on('error', err => console.error('Failed to stop docker-compose:', err));
  await new Promise(resolve => stopProcess.on('close', resolve)); // Wait for compose down

  if (dynamodbProcess && !dynamodbProcess.killed) {
    dynamodbProcess.kill();
  }
  console.log('DynamoDB Local container stopped.');
}, 30000); // Increase timeout for afterAll

describe('DynamoDBStore Integration Tests', () => {
  let store: DynamoDBStore;

  beforeAll(async () => {
    // Initialize main store instance used by most tests
    store = new DynamoDBStore({
      name: 'DynamoDBStoreTest',
      config: {
        tableName: TEST_TABLE_NAME,
        endpoint: LOCAL_ENDPOINT,
        region: LOCAL_REGION,
        credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
      },
    });
    console.log('Main DynamoDBStore initialized for tests.');
  });

  beforeEach(async () => {
    // Clear table between tests using the setup client
    await clearSingleTable(setupClient, TEST_TABLE_NAME);
  });

  afterAll(async () => {
    // No client.destroy() needed here as the store manages its internal client
    // Or if the store exposes a close/destroy method, call that.
    if (store) {
      await store.close(); // Assuming store has a close method
    }
  });

  // DynamoDB-specific tests
  describe('DynamoDB-specific operations', () => {
    describe('Entity Operations', () => {
      test('should persist and retrieve thread metadata', async () => {
        const now = new Date();
        const threadId = 'metadata-thread';
        const metadata = { user: 'test-user', complex: { nested: true, arr: [1, 'a'] } };
        const thread: StorageThreadType = {
          id: threadId,
          resourceId: 'resource-meta',
          title: 'Metadata Test Thread',
          createdAt: now,
          updatedAt: now,
          metadata: metadata,
        };
        await store.saveThread({ thread });
        const retrieved = await store.getThreadById({ threadId });
        expect(retrieved).toBeDefined();
        expect(retrieved?.metadata).toEqual(metadata); // ElectroDB should handle JSON stringify/parse
      });

      test('should handle large workflow snapshots near DynamoDB item size limit', async () => {
        // Test remains largely the same, relies on clearSingleTable working
        const now = Date.now();
        const largeSnapshot: WorkflowRunState = {
          // ... (rest of the large snapshot definition) ...
          value: { state: 'test' },
          context: {
            steps: { step1: { status: 'success', payload: { data: 'test' } } },
            triggerData: { source: 'test' },
            attempts: { step1: 1 },
          },
          activePaths: [{ stepPath: ['test'], stepId: 'step1', status: 'success' }],
          suspendedPaths: { test: [1] },
          runId: 'test-run-large', // Use unique runId
          timestamp: now,
          childStates: {
            largeState: {
              value: { state: 'test' },
              context: {
                steps: { step1: { status: 'success', payload: { data: 'x'.repeat(380000) } } }, // Just under 400KB limit
                triggerData: { source: 'test' },
                attempts: { step1: 1 },
              },
              activePaths: [{ stepPath: ['test'], stepId: 'step1', status: 'success' }],
              suspendedPaths: { test: [1] },
              runId: 'test-run-large-child',
              timestamp: now,
            },
          },
        };

        await expect(
          store.persistWorkflowSnapshot({
            workflowName: 'test-workflow-large',
            runId: 'test-run-large',
            snapshot: largeSnapshot,
          }),
        ).resolves.not.toThrow();

        const retrieved = await store.loadWorkflowSnapshot({
          workflowName: 'test-workflow-large',
          runId: 'test-run-large',
        });

        expect(retrieved).toEqual(largeSnapshot);
      }, 10000); // Increase timeout for potentially large item handling

      test('should handle concurrent thread updates (last writer wins)', async () => {
        // Test remains largely the same, verifies final state
        const threadId = 'concurrent-thread';
        const resourceId = 'resource-123';
        const now = new Date();
        const thread: StorageThreadType = {
          id: threadId,
          resourceId,
          title: 'Initial Title',
          createdAt: now,
          updatedAt: now,
          metadata: { initial: true },
        };
        await store.saveThread({ thread });

        // Simulate potential delay between read and write for update 1
        const update1 = async () => {
          await new Promise(res => setTimeout(res, 50)); // Short delay
          await store.updateThread({
            id: threadId,
            title: 'Updated Thread 1',
            metadata: { update: 1, time: Date.now() },
          });
        };
        // Simulate potential delay between read and write for update 2
        const update2 = async () => {
          await new Promise(res => setTimeout(res, 100)); // Slightly longer delay
          await store.updateThread({
            id: threadId,
            title: 'Updated Thread 2',
            metadata: { update: 2, time: Date.now() },
          });
        };

        await Promise.all([update1(), update2()]);

        const retrieved = await store.getThreadById({ threadId });
        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(threadId);
        // In DynamoDB default (non-conditional) updates, the last writer wins.
        // We expect title 2 / metadata 2 because update2 started later.
        expect(retrieved?.title).toBe('Updated Thread 2');
        expect(retrieved?.metadata?.update).toBe(2);
      });
    });

    describe('Batch Operations', () => {
      test('should handle batch message inserts efficiently (up to 25 items)', async () => {
        const startTime = Date.now(); // Get a base time
        const threadId = 'batch-thread';
        const messages: MessageType[] = Array.from({ length: 25 }, (_, i) => ({
          id: `msg-${i}`,
          threadId,
          resourceId: 'test-resource',
          content: `Message ${i}`,
          // Increment timestamp slightly for each message to ensure order
          createdAt: new Date(startTime + i),
          role: 'user',
          type: 'text',
        }));

        // Assuming saveMessages uses BatchWriteItem internally
        await expect(store.saveMessages({ messages })).resolves.not.toThrow();

        const retrieved = await store.getMessages({ threadId });
        expect(retrieved).toHaveLength(25);
        // Now the order should be guaranteed by the ascending createdAt timestamp
        expect(retrieved[0]?.content).toBe('Message 0');
        expect(retrieved[24]?.content).toBe('Message 24');
      });

      test('should handle batch inserts exceeding 25 items (if saveMessages chunks)', async () => {
        const startTime = Date.now(); // Get a base time
        const threadId = 'batch-thread-large';
        const messages: MessageType[] = Array.from({ length: 30 }, (_, i) => ({
          id: `msg-large-${i}`,
          threadId,
          resourceId: 'test-resource-large',
          content: `Large Message ${i}`,
          // Increment timestamp slightly for each message to ensure order
          createdAt: new Date(startTime + i),
          role: 'user',
          type: 'text',
        }));

        await expect(store.saveMessages({ messages })).resolves.not.toThrow();

        const retrieved = await store.getMessages({ threadId });
        expect(retrieved).toHaveLength(30); // Verify all were saved
        // Add order check for the > 25 test as well
        expect(retrieved[0]?.content).toBe('Large Message 0');
        expect(retrieved[29]?.content).toBe('Large Message 29');
      });
    });

    describe('Single-Table Design', () => {
      test('should maintain entity separation in single table', async () => {
        // Test remains largely the same
        const threadId = 'mixed-thread';
        const workflowName = 'mixed-workflow';
        const now = new Date();
        const thread: StorageThreadType = {
          id: threadId,
          resourceId: 'mixed-resource',
          title: 'Mixed Thread',
          createdAt: now,
          updatedAt: now,
          metadata: { type: 'thread' },
        };
        await store.saveThread({ thread });

        const workflowSnapshot: WorkflowRunState = {
          // ...(snapshot definition)
          value: { state: 'test' },
          context: {
            steps: { step1: { status: 'success', payload: { data: 'test' } } },
            triggerData: { source: 'test' },
            attempts: { step1: 1 },
          },
          activePaths: [{ stepPath: ['test'], stepId: 'step1', status: 'success' }],
          suspendedPaths: { test: [1] },
          runId: 'mixed-run',
          timestamp: Date.now(),
        };
        await store.persistWorkflowSnapshot({ workflowName, runId: 'mixed-run', snapshot: workflowSnapshot });

        const retrievedThread = await store.getThreadById({ threadId });
        const retrievedWorkflow = await store.loadWorkflowSnapshot({ workflowName, runId: 'mixed-run' });

        expect(retrievedThread?.metadata?.type).toBe('thread');
        expect(retrievedWorkflow).toEqual(workflowSnapshot);
      });
    });

    describe('Error Handling', () => {
      test('should handle non-existent IDs gracefully for getById methods', async () => {
        const nonExistentId = 'does-not-exist';
        // Test getThreadById (already partially covered but good to keep specific)
        const thread = await store.getThreadById({ threadId: nonExistentId });
        expect(thread).toBeNull();

        // Test loadWorkflowSnapshot (already covered in Workflow tests, technically)
        const snapshot = await store.loadWorkflowSnapshot({ workflowName: nonExistentId, runId: nonExistentId });
        expect(snapshot).toBeNull();

        // Test getWorkflowRunById (already covered in Workflow tests, technically)
        const workflowRun = await store.getWorkflowRunById({ runId: nonExistentId });
        expect(workflowRun).toBeNull();
      });

      test('getMessages should return empty array for non-existent thread', async () => {
        const messages = await store.getMessages({ threadId: 'non-existent-thread' });
        expect(messages).toEqual([]);
      });

      test('getThreadsByResourceId should return empty array for non-existent resourceId', async () => {
        const threads = await store.getThreadsByResourceId({ resourceId: 'non-existent-resource' });
        expect(threads).toEqual([]);
      });

      test('getTraces should return empty array when no traces match filter', async () => {
        const tracesByName = await store.getTraces({ name: 'non-existent-trace', page: 1, perPage: 10 });
        expect(tracesByName).toEqual([]);
        const tracesByScope = await store.getTraces({ scope: 'non-existent-scope', page: 1, perPage: 10 });
        expect(tracesByScope).toEqual([]);
      });

      test('getEvalsByAgentName should return empty array for non-existent agent', async () => {
        const evals = await store.getEvalsByAgentName('non-existent-agent');
        expect(evals).toEqual([]);
      });

      test('getWorkflowRuns should return empty result for non-existent filters', async () => {
        const { runs: runsByName, total: totalByName } = await store.getWorkflowRuns({
          workflowName: 'non-existent-workflow',
        });
        expect(runsByName).toEqual([]);
        expect(totalByName).toBe(0);

        const { runs: runsByResource, total: totalByResource } = await store.getWorkflowRuns({
          resourceId: 'non-existent-resource',
        });
        expect(runsByResource).toEqual([]);
        expect(totalByResource).toBe(0);
      });
    }); // End Error Handling describe
  });

  // --- Trace Operations Tests ---
  describe('Trace Operations', () => {
    const sampleTrace = (name: string, scope: string, startTime = Date.now()) => ({
      id: `trace-${randomUUID()}`,
      parentSpanId: `span-${randomUUID()}`,
      traceId: `traceid-${randomUUID()}`,
      name,
      scope,
      kind: 1, // Example kind
      startTime: startTime,
      endTime: startTime + 100, // Example duration
      status: JSON.stringify({ code: 0 }), // Example status
      attributes: JSON.stringify({ key: 'value', scopeAttr: scope }),
      events: JSON.stringify([{ name: 'event1', timestamp: startTime + 50 }]),
      links: JSON.stringify([]),
      createdAt: new Date(startTime).toISOString(),
      updatedAt: new Date(startTime).toISOString(),
    });

    test('should batch insert and retrieve traces', async () => {
      const trace1 = sampleTrace('trace-op-1', 'scope-A');
      const trace2 = sampleTrace('trace-op-2', 'scope-A', Date.now() + 10);
      const trace3 = sampleTrace('trace-op-3', 'scope-B', Date.now() + 20);
      const records = [trace1, trace2, trace3];

      await expect(store.batchTraceInsert({ records })).resolves.not.toThrow();

      // Retrieve all (via scan, assuming low test data volume)
      const allTraces = await store.getTraces({ page: 1, perPage: 10 });
      expect(allTraces.length).toBe(3);
    });

    test('should retrieve traces filtered by name using GSI', async () => {
      const trace1 = sampleTrace('trace-filter-name', 'scope-X');
      const trace2 = sampleTrace('trace-filter-name', 'scope-Y', Date.now() + 10);
      const trace3 = sampleTrace('other-name', 'scope-X', Date.now() + 20);
      await store.batchTraceInsert({ records: [trace1, trace2, trace3] });

      const filteredTraces = await store.getTraces({ name: 'trace-filter-name', page: 1, perPage: 10 });
      expect(filteredTraces.length).toBe(2);
      expect(filteredTraces.every(t => t.name === 'trace-filter-name')).toBe(true);
      // Check if sorted by startTime (GSI SK) - ascending default
      expect(filteredTraces[0].scope).toBe('scope-X');
      expect(filteredTraces[1].scope).toBe('scope-Y');
    });

    test('should retrieve traces filtered by scope using GSI', async () => {
      const trace1 = sampleTrace('trace-filter-scope-A', 'scope-TARGET');
      const trace2 = sampleTrace('trace-filter-scope-B', 'scope-OTHER', Date.now() + 10);
      const trace3 = sampleTrace('trace-filter-scope-C', 'scope-TARGET', Date.now() + 20);
      await store.batchTraceInsert({ records: [trace1, trace2, trace3] });

      const filteredTraces = await store.getTraces({ scope: 'scope-TARGET', page: 1, perPage: 10 });
      expect(filteredTraces.length).toBe(2);
      expect(filteredTraces.every(t => t.scope === 'scope-TARGET')).toBe(true);
      // Check if sorted by startTime (GSI SK) - ascending default
      expect(filteredTraces[0].name).toBe('trace-filter-scope-A');
      expect(filteredTraces[1].name).toBe('trace-filter-scope-C');
    });

    test('should handle pagination for getTraces', async () => {
      const traceData = Array.from({ length: 5 }, (_, i) =>
        sampleTrace('trace-page', `scope-page`, Date.now() + i * 10),
      );
      await store.batchTraceInsert({ records: traceData });

      // Get page 1 (first 2 items)
      const page1 = await store.getTraces({ name: 'trace-page', page: 1, perPage: 2 });
      expect(page1.length).toBe(2);
      // Use non-null assertion (!) since lengths are verified
      expect(page1[0]!.startTime).toBe(traceData[0]!.startTime);
      expect(page1[1]!.startTime).toBe(traceData[1]!.startTime);

      // Get page 2 (next 2 items)
      const page2 = await store.getTraces({ name: 'trace-page', page: 2, perPage: 2 });
      expect(page2.length).toBe(2);
      expect(page2[0]!.startTime).toBe(traceData[2]!.startTime);
      expect(page2[1]!.startTime).toBe(traceData[3]!.startTime);

      // Get page 3 (last 1 item)
      const page3 = await store.getTraces({ name: 'trace-page', page: 3, perPage: 2 });
      expect(page3.length).toBe(1);
      expect(page3[0]!.startTime).toBe(traceData[4]!.startTime);

      // Get page beyond results
      const page4 = await store.getTraces({ name: 'trace-page', page: 4, perPage: 2 });
      expect(page4.length).toBe(0);
    });
  }); // End Trace Operations describe

  // --- Eval Operations Tests ---
  describe('Eval Operations', () => {
    const sampleEval = (agentName: string, isTest = false, createdAt = new Date()) => {
      const testInfo = isTest ? { testPath: 'test/path.ts', testName: 'Test Name' } : undefined;
      return {
        entity: 'eval', // Important for saving
        agent_name: agentName,
        input: 'Sample input',
        output: 'Sample output',
        result: JSON.stringify({ score: Math.random() }), // Random score
        metric_name: 'sample-metric',
        instructions: 'Sample instructions',
        test_info: testInfo ? JSON.stringify(testInfo) : undefined,
        global_run_id: `global-${randomUUID()}`,
        run_id: `run-${randomUUID()}`,
        created_at: createdAt.toISOString(),
        // Add core MastraStorage fields
        createdAt: createdAt.toISOString(),
        updatedAt: createdAt.toISOString(),
        metadata: JSON.stringify({ custom: 'eval_meta' }),
      };
    };

    test('should retrieve evals by agent name using GSI and filter by type', async () => {
      const agent1 = 'eval-agent-1';
      const agent2 = 'eval-agent-2';
      const time1 = new Date();
      const time2 = new Date(Date.now() + 1000);
      const time3 = new Date(Date.now() + 2000);
      const time4 = new Date(Date.now() + 3000);

      const eval1_live = sampleEval(agent1, false, time1);
      const eval1_test = sampleEval(agent1, true, time2);
      const eval2_live = sampleEval(agent2, false, time3);
      const eval1_live_later = sampleEval(agent1, false, time4);

      // Use generic batchInsert (which expects entity prop already set)
      await store.batchInsert({
        tableName: TABLE_EVALS,
        records: [eval1_live, eval1_test, eval2_live, eval1_live_later],
      });

      // Get all for agent1 (expecting DESCENDING order now)
      const allAgent1 = await store.getEvalsByAgentName(agent1);
      expect(allAgent1.length).toBe(3);
      // Assert descending order (newest first)
      expect(allAgent1[0]!.runId).toBe(eval1_live_later.run_id); // Newest (time4)
      expect(allAgent1[1]!.runId).toBe(eval1_test.run_id); // Middle (time2)
      expect(allAgent1[2]!.runId).toBe(eval1_live.run_id); // Oldest (time1)

      // Get only live for agent1 (should be 2, ordered descending)
      const liveAgent1 = await store.getEvalsByAgentName(agent1, 'live');
      expect(liveAgent1.length).toBe(2);
      // Assert descending order
      expect(liveAgent1[0]!.runId).toBe(eval1_live_later.run_id); // Newest live (time4)
      expect(liveAgent1[1]!.runId).toBe(eval1_live.run_id); // Oldest live (time1)

      // Get only test for agent1 (should be 1)
      const testAgent1 = await store.getEvalsByAgentName(agent1, 'test');
      expect(testAgent1.length).toBe(1);
      expect(testAgent1[0]!.runId).toBe(eval1_test.run_id);
      expect(testAgent1[0]!.testInfo).toEqual(JSON.parse(eval1_test.test_info!));

      // Get for agent2 (should be 1)
      const allAgent2 = await store.getEvalsByAgentName(agent2);
      expect(allAgent2.length).toBe(1);
      expect(allAgent2[0]!.runId).toBe(eval2_live.run_id);

      // Get for non-existent agent
      const none = await store.getEvalsByAgentName('non-existent-agent');
      expect(none.length).toBe(0);
    });
  }); // End Eval Operations describe

  // --- Workflow Operations Tests ---
  describe('Workflow Operations', () => {
    const sampleWorkflowSnapshot = (
      workflowName: string,
      runId: string,
      resourceId?: string,
      createdAt = new Date(),
      status = 'running',
    ): { recordData: Record<string, any>; snapshot: WorkflowRunState } => {
      const snapshot: WorkflowRunState = {
        value: { currentState: status },
        context: {
          steps: { step1: { status: 'success' } },
          triggerData: { source: 'test' },
          attempts: { step1: 1 },
        },
        activePaths: [],
        suspendedPaths: {},
        runId: runId,
        timestamp: createdAt.getTime(),
        ...(resourceId && { resourceId: resourceId }), // Conditionally add resourceId to snapshot
      };
      return {
        recordData: {
          entity: 'workflow_snapshot',
          workflow_name: workflowName,
          run_id: runId,
          snapshot: JSON.stringify(snapshot),
          createdAt: createdAt.toISOString(),
          updatedAt: createdAt.toISOString(),
          resourceId: resourceId, // Store resourceId directly if available
          metadata: JSON.stringify({ wf: 'meta' }),
        },
        snapshot: snapshot,
      };
    };

    test('should persist and load a workflow snapshot', async () => {
      const wfName = 'persist-test-wf';
      const runId = `run-${randomUUID()}`;
      const { snapshot } = sampleWorkflowSnapshot(wfName, runId);

      await expect(
        store.persistWorkflowSnapshot({
          workflowName: wfName,
          runId: runId,
          snapshot: snapshot,
        }),
      ).resolves.not.toThrow();

      const loadedSnapshot = await store.loadWorkflowSnapshot({
        workflowName: wfName,
        runId: runId,
      });
      // Compare only relevant parts, as persist might add internal fields
      expect(loadedSnapshot?.runId).toEqual(snapshot.runId);
      expect(loadedSnapshot?.value).toEqual(snapshot.value);
      expect(loadedSnapshot?.context).toEqual(snapshot.context);
    });

    test('getWorkflowRunById should retrieve correct run', async () => {
      const wfName = 'get-by-id-wf';
      const runId1 = `run-${randomUUID()}`;
      const runId2 = `run-${randomUUID()}`;
      const wf1 = sampleWorkflowSnapshot(wfName, runId1);
      const wf2 = sampleWorkflowSnapshot(wfName, runId2);

      await store.batchInsert({ tableName: TABLE_WORKFLOW_SNAPSHOT, records: [wf1.recordData, wf2.recordData] });

      const found = await store.getWorkflowRunById({ runId: runId1, workflowName: wfName });
      expect(found).toBeDefined();
      expect(found!.runId).toBe(runId1);
      expect(found!.workflowName).toBe(wfName);

      const notFound = await store.getWorkflowRunById({ runId: 'non-existent', workflowName: wfName });
      expect(notFound).toBeNull();
    });

    test('getWorkflowRuns should return all runs when no filters applied', async () => {
      const wfName = 'get-runs-all';
      const runId1 = `run-${randomUUID()}`;
      const runId2 = `run-${randomUUID()}`;
      const wf1 = sampleWorkflowSnapshot(wfName, runId1, undefined, new Date(Date.now() - 1000));
      const wf2 = sampleWorkflowSnapshot(wfName, runId2, undefined, new Date());

      await store.batchInsert({ tableName: TABLE_WORKFLOW_SNAPSHOT, records: [wf1.recordData, wf2.recordData] });

      const { runs, total } = await store.getWorkflowRuns(); // No filters
      // Note: Scan order is not guaranteed, check for presence and count
      expect(total).toBe(2);
      expect(runs.length).toBe(2);
      expect(runs.map(r => r.runId)).toEqual(expect.arrayContaining([runId1, runId2]));
    });

    test('getWorkflowRuns should filter by workflowName', async () => {
      const wfName1 = 'get-runs-filter-name1';
      const wfName2 = 'get-runs-filter-name2';
      const runId1 = `run-${randomUUID()}`;
      const runId2 = `run-${randomUUID()}`;
      const wf1 = sampleWorkflowSnapshot(wfName1, runId1);
      const wf2 = sampleWorkflowSnapshot(wfName2, runId2);

      await store.batchInsert({ tableName: TABLE_WORKFLOW_SNAPSHOT, records: [wf1.recordData, wf2.recordData] });

      const { runs, total } = await store.getWorkflowRuns({ workflowName: wfName1 });
      expect(total).toBe(1);
      expect(runs.length).toBe(1);
      expect(runs[0]!.runId).toBe(runId1);
    });

    test('getWorkflowRuns should filter by resourceId', async () => {
      const wfName = 'get-runs-filter-resource';
      const resource1 = 'resource-filter-1';
      const resource2 = 'resource-filter-2';
      const runId1 = `run-${randomUUID()}`;
      const runId2 = `run-${randomUUID()}`;
      const runId3 = `run-${randomUUID()}`;
      const wf1 = sampleWorkflowSnapshot(wfName, runId1, resource1);
      const wf2 = sampleWorkflowSnapshot(wfName, runId2, resource2);
      const wf3 = sampleWorkflowSnapshot(wfName, runId3, resource1);

      await store.batchInsert({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        records: [wf1.recordData, wf2.recordData, wf3.recordData],
      });

      const { runs, total } = await store.getWorkflowRuns({ resourceId: resource1 });
      // Note: Scan order not guaranteed
      expect(total).toBe(2);
      expect(runs.length).toBe(2);
      expect(runs.map(r => r.runId)).toEqual(expect.arrayContaining([runId1, runId3]));
      expect(runs.every(r => r.resourceId === resource1)).toBe(true);
    });

    test('getWorkflowRuns should filter by date range', async () => {
      const wfName = 'get-runs-filter-date';
      const time1 = new Date(2024, 0, 10); // Jan 10 2024
      const time2 = new Date(2024, 0, 15); // Jan 15 2024
      const time3 = new Date(2024, 0, 20); // Jan 20 2024
      const runId1 = `run-${randomUUID()}`;
      const runId2 = `run-${randomUUID()}`;
      const runId3 = `run-${randomUUID()}`;
      const wf1 = sampleWorkflowSnapshot(wfName, runId1, undefined, time1);
      const wf2 = sampleWorkflowSnapshot(wfName, runId2, undefined, time2);
      const wf3 = sampleWorkflowSnapshot(wfName, runId3, undefined, time3);

      await store.batchInsert({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        records: [wf1.recordData, wf2.recordData, wf3.recordData],
      });

      const { runs, total } = await store.getWorkflowRuns({
        fromDate: new Date(2024, 0, 12), // Jan 12
        toDate: new Date(2024, 0, 18), // Jan 18
      });
      expect(total).toBe(1);
      expect(runs.length).toBe(1);
      expect(runs[0]!.runId).toBe(runId2); // Only wf2 falls within the range
    });

    test('getWorkflowRuns should handle pagination (limit/offset)', async () => {
      const wfName = 'get-runs-pagination';
      const snapshots = Array.from({ length: 5 }, (_, i) =>
        sampleWorkflowSnapshot(wfName, `run-page-${i}`, undefined, new Date(Date.now() + i * 1000)),
      );
      await store.batchInsert({ tableName: TABLE_WORKFLOW_SNAPSHOT, records: snapshots.map(s => s.recordData) });

      // Get page 1 (limit 2, offset 0)
      const page1 = await store.getWorkflowRuns({ workflowName: wfName, limit: 2, offset: 0 });
      expect(page1.total).toBe(5);
      expect(page1.runs.length).toBe(2);
      // Scan order not guaranteed, check for presence of two expected runs
      const page1Ids = page1.runs.map(r => r.runId);
      expect(snapshots.slice(0, 2).map(s => s!.recordData.run_id)).toEqual(expect.arrayContaining(page1Ids));

      // Get page 2 (limit 2, offset 2)
      const page2 = await store.getWorkflowRuns({ workflowName: wfName, limit: 2, offset: 2 });
      expect(page2.total).toBe(5);
      expect(page2.runs.length).toBe(2);
      const page2Ids = page2.runs.map(r => r.runId);
      expect(snapshots.slice(2, 4).map(s => s!.recordData.run_id)).toEqual(expect.arrayContaining(page2Ids));

      // Get page 3 (limit 2, offset 4)
      const page3 = await store.getWorkflowRuns({ workflowName: wfName, limit: 2, offset: 4 });
      expect(page3.total).toBe(5);
      expect(page3.runs.length).toBe(1);
      // Use explicit type assertion for runs array access to fix linter error
      expect((page3.runs as WorkflowRun[])[0]!.runId).toBe(snapshots[4]!.recordData.run_id);

      // Get page beyond results (offset 5)
      const page4 = await store.getWorkflowRuns({ workflowName: wfName, limit: 2, offset: 5 });
      expect(page4.total).toBe(5);
      expect(page4.runs.length).toBe(0);
    });
  }); // End Workflow Operations describe

  // --- Initialization & Configuration Tests ---
  describe('Initialization & Configuration', () => {
    test('should throw error if tableName is missing in config', () => {
      expect(() => {
        new DynamoDBStore({
          name: 'MissingTableStore',
          config: {
            endpoint: LOCAL_ENDPOINT,
            region: LOCAL_REGION,
            credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
          } as any, // Cast to any to bypass compile-time check for this specific test
        });
      }).toThrow(/tableName must be provided/); // Check for specific error message if possible
    });

    test('should throw error during operations if table does not exist', async () => {
      // Use a valid but random table name unlikely to exist
      const nonExistentTableName = `non-existent-${randomUUID()}`;
      const storeWithInvalidTable = new DynamoDBStore({
        name: 'InvalidTableStore',
        config: {
          tableName: nonExistentTableName,
          endpoint: LOCAL_ENDPOINT,
          region: LOCAL_REGION,
          credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
        },
      });

      await expect(storeWithInvalidTable.getThreadById({ threadId: 'any-id' }))
        .rejects // Update regex to match either DDB error or ElectroDB wrapper
        .toThrow(/ResourceNotFoundException|Table.*does not exist|Cannot do operations on a non-existent table/);
    });

    test('init() should throw error if table does not exist', async () => {
      // Use a valid but random table name unlikely to exist
      const nonExistentTableName = `non-existent-init-${randomUUID()}`;
      const storeWithInvalidTable = new DynamoDBStore({
        name: 'InvalidTableStoreInit',
        config: {
          tableName: nonExistentTableName,
          endpoint: LOCAL_ENDPOINT,
          region: LOCAL_REGION,
          credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
        },
      });

      await expect(storeWithInvalidTable.init())
        .rejects // Update regex here too for consistency
        .toThrow(/ResourceNotFoundException|Table.*does not exist|Cannot do operations on a non-existent table/);
    });
  }); // End Initialization & Configuration describe

  // --- Generic Storage Methods Tests ---
  describe('Generic Storage Methods (`insert`, `load`, `batchInsert`, `clearTable`)', () => {
    // Declare genericStore specific to this block
    let genericStore: DynamoDBStore;

    beforeAll(() => {
      // Initialize genericStore using the same config as the main store
      genericStore = new DynamoDBStore({
        name: 'DynamoDBGenericTest',
        config: {
          tableName: TEST_TABLE_NAME, // Ensure this uses the correct test table
          endpoint: LOCAL_ENDPOINT,
          region: LOCAL_REGION,
          credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
        },
      });
      console.log('Generic test store initialized for generic tests.');
    });

    const sampleThreadData = (id: string) => ({
      entity: 'thread',
      id: id,
      resourceId: `resource-${randomUUID()}`,
      title: 'Generic Test Thread',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: JSON.stringify({ generic: true }),
    });

    test('insert() should save a record', async () => {
      const threadId = `thread-${randomUUID()}`;
      const record = sampleThreadData(threadId);
      // Use the genericStore instance
      await expect(genericStore.insert({ tableName: TABLE_THREADS, record })).resolves.not.toThrow();
      const loaded = await genericStore.load<StorageThreadType>({ tableName: TABLE_THREADS, keys: { id: threadId } });
      expect(loaded).not.toBeNull();
      if (loaded) {
        expect(loaded.id).toBe(threadId);
        expect(loaded.title).toBe('Generic Test Thread');
        expect(loaded.metadata).toEqual({ generic: true });
      }
    });

    test('load() should return null for non-existent record', async () => {
      // Use the genericStore instance
      const loaded = await genericStore.load({ tableName: TABLE_THREADS, keys: { id: 'non-existent-generic' } });
      expect(loaded).toBeNull();
    });

    test('batchInsert() should save multiple records', async () => {
      const threadId1 = `thread-batch-${randomUUID()}`;
      const threadId2 = `thread-batch-${randomUUID()}`;
      const records = [sampleThreadData(threadId1), sampleThreadData(threadId2)];
      // Use the genericStore instance
      await expect(genericStore.batchInsert({ tableName: TABLE_THREADS, records })).resolves.not.toThrow();
      const loaded1 = await genericStore.load<StorageThreadType>({ tableName: TABLE_THREADS, keys: { id: threadId1 } });
      const loaded2 = await genericStore.load<StorageThreadType>({ tableName: TABLE_THREADS, keys: { id: threadId2 } });
      expect(loaded1).toBeDefined();
      expect(loaded2).toBeDefined();
      expect(loaded1?.id).toBe(threadId1);
      expect(loaded2?.id).toBe(threadId2);
    });

    test('clearTable() should remove all records for the logical table', async () => {
      const threadId1 = `thread-clear-${randomUUID()}`;
      const threadId2 = `thread-clear-${randomUUID()}`;
      const records = [sampleThreadData(threadId1), sampleThreadData(threadId2)];
      // Use the genericStore instance
      await genericStore.batchInsert({ tableName: TABLE_THREADS, records });
      expect(
        await genericStore.load<StorageThreadType>({ tableName: TABLE_THREADS, keys: { id: threadId1 } }),
      ).toBeDefined();
      expect(
        await genericStore.load<StorageThreadType>({ tableName: TABLE_THREADS, keys: { id: threadId2 } }),
      ).toBeDefined();
      await expect(genericStore.clearTable({ tableName: TABLE_THREADS })).resolves.not.toThrow();
      expect(
        await genericStore.load<StorageThreadType>({ tableName: TABLE_THREADS, keys: { id: threadId1 } }),
      ).toBeNull();
      expect(
        await genericStore.load<StorageThreadType>({ tableName: TABLE_THREADS, keys: { id: threadId2 } }),
      ).toBeNull();
    });
  }); // End Generic Storage Methods describe
}); // End Main Describe
