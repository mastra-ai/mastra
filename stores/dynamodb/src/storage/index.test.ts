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

  createTestSuite(
    new DynamoDBStore({
      name: 'DynamoDBStoreTest',
      config: {
        id: 'dynamodb-test-store',
        tableName: TEST_TABLE_NAME,
        endpoint: LOCAL_ENDPOINT,
        region: LOCAL_REGION,
        credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
      },
    }),
  );
});
