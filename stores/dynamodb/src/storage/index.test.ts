import { spawn } from 'child_process';
import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ListTablesCommand,
  waitUntilTableExists,
  waitUntilTableNotExists,
} from '@aws-sdk/client-dynamodb';
import { createTestSuite } from '@internal/storage-test-utils';
import { beforeAll, describe } from 'vitest';
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

// // Function to clear all items from the single table
// async function clearSingleTable(client: DynamoDBClient, tableName: string) {
//   let ExclusiveStartKey: Record<string, any> | undefined;
//   let items: Record<string, any>[] = [];

//   // Scan all items (handling pagination)
//   do {
//     const scanOutput = await client.send(
//       new ScanCommand({
//         TableName: tableName,
//         ExclusiveStartKey,
//         ProjectionExpression: 'pk, sk', // Only need keys for deletion
//       }),
//     );
//     items = items.concat(scanOutput.Items || []);
//     ExclusiveStartKey = scanOutput.LastEvaluatedKey;
//   } while (ExclusiveStartKey);

//   if (items.length === 0) {
//     return; // Nothing to delete
//   }

//   // Batch delete items (handling DynamoDB 25 item limit per batch)
//   const deleteRequests = items.map(item => ({
//     DeleteRequest: {
//       Key: { pk: item.pk, sk: item.sk },
//     },
//   }));

//   for (let i = 0; i < deleteRequests.length; i += 25) {
//     const batch = deleteRequests.slice(i, i + 25);
//     const command = new BatchWriteItemCommand({
//       RequestItems: {
//         [tableName]: batch,
//       },
//     });
//     // Handle unprocessed items if necessary (though less likely with local)
//     let result = await client.send(command);
//     while (
//       result.UnprocessedItems &&
//       result.UnprocessedItems[tableName] &&
//       result.UnprocessedItems[tableName].length > 0
//     ) {
//       console.warn(`Retrying ${result.UnprocessedItems[tableName].length} unprocessed delete items...`);
//       await new Promise(res => setTimeout(res, 200)); // Simple backoff
//       const retryCommand = new BatchWriteItemCommand({ RequestItems: result.UnprocessedItems });
//       result = await client.send(retryCommand);
//     }
//   }
//   // console.log(`Cleared ${items.length} items from ${tableName}`);
// }

describe('DynamoDBStore', () => {
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
  // afterAll(async () => {
  //   console.log('Stopping DynamoDB Local container...');
  //   // Optionally delete the table
  //   // try {
  //   //   await setupClient.send(new DeleteTableCommand({ TableName: TEST_TABLE_NAME }));
  //   //   await waitUntilTableNotExists({ client: setupClient, maxWaitTime: 60 }, { TableName: TEST_TABLE_NAME });
  //   //   console.log(`Test table ${TEST_TABLE_NAME} deleted.`);
  //   // } catch (error) {
  //   //   console.error(`Error deleting test table ${TEST_TABLE_NAME}:`, error);
  //   // }

  //   if (setupClient) {
  //     setupClient.destroy();
  //   }

  //   const stopProcess = spawn('docker-compose', ['down', '--volumes'], {
  //     // Remove volumes too
  //     cwd: __dirname,
  //     stdio: 'pipe',
  //   });
  //   stopProcess.stderr?.on('data', data => console.error(`docker-compose down stderr: ${data}`));
  //   stopProcess.on('error', err => console.error('Failed to stop docker-compose:', err));
  //   await new Promise(resolve => stopProcess.on('close', resolve)); // Wait for compose down

  //   if (dynamodbProcess && !dynamodbProcess.killed) {
  //     dynamodbProcess.kill();
  //   }
  //   console.log('DynamoDB Local container stopped.');
  // }, 30000); // Increase timeout for afterAll

  createTestSuite(
    new DynamoDBStore({
      name: 'DynamoDBStoreTest',
      config: {
        tableName: TEST_TABLE_NAME,
        endpoint: LOCAL_ENDPOINT,
        region: LOCAL_REGION,
        credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
      },
    }),
  );
});
