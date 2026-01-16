# DynamoDB Table Setup for Mastra Single-Table Design

This document explains how to set up the required DynamoDB table structure for use with the `@mastra/dynamodb` package.

## Table Structure

The `@mastra/dynamodb` package uses a single-table design pattern with ElectroDB. You need to create a single DynamoDB table with the following structure:

- **Table Name**: You can choose any name, but remember to pass it to the `DynamoDBStore` constructor
- **Partition Key**: `pk` (String)
- **Sort Key**: `sk` (String)
- **Global Secondary Indexes**:
  - **GSI1**:
    - Partition Key: `gsi1pk` (String)
    - Sort Key: `gsi1sk` (String)
  - **GSI2**:
    - Partition Key: `gsi2pk` (String)
    - Sort Key: `gsi2sk` (String)

_(Note: These GSIs (Global Secondary Indexes) allow efficient querying on attributes other than the primary key, enabling different data access patterns required by Mastra components.)_

### GSI Usage Details:

- **GSI1 (Index Name: `gsi1`)**: This index is used by multiple entities for common lookup patterns:
  - `threadEntity`: Query by `resourceId` (`byResource` index).
  - `messageEntity`: Query by `threadId` (`byThread` index).
  - `traceEntity`: Query by `name` (`byName` index).
  - `evalEntity`: Query by `agent_name` (`byAgent` index).

- **GSI2 (Index Name: `gsi2`)**: This index is used for:
  - `traceEntity`: Query by `scope` (`byScope` index).
  - `workflowSnapshotEntity`: Query by `run_id` (`byRunId` index).

## CloudFormation Template

Here's an example CloudFormation template for creating the required table, reflecting the GSI usage:

```yaml
Resources:
  MastraSingleTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: mastra-single-table
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: pk
          AttributeType: S
        - AttributeName: sk
          AttributeType: S
        - AttributeName: gsi1pk
          AttributeType: S
        - AttributeName: gsi1sk
          AttributeType: S
        - AttributeName: gsi2pk
          AttributeType: S
        - AttributeName: gsi2sk
          AttributeType: S
      KeySchema:
        - AttributeName: pk
          KeyType: HASH
        - AttributeName: sk
          KeyType: RANGE
      GlobalSecondaryIndexes:
        - IndexName: gsi1
          KeySchema:
            - AttributeName: gsi1pk
              KeyType: HASH
            - AttributeName: gsi1sk
              KeyType: RANGE
          Projection:
            ProjectionType: ALL # Suitable for varied query needs of GSI1
        - IndexName: gsi2
          KeySchema:
            - AttributeName: gsi2pk
              KeyType: HASH
            - AttributeName: gsi2sk
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
      PointInTimeRecoverySpecification:
        PointInTimeRecoveryEnabled: true
      SSESpecification:
        SSEEnabled: true
```

## AWS CDK Example

Here's how to create the table using AWS CDK:

```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class MastraDynamoDbStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Consider parameterizing the table name for different environments
    const tableName = 'mastra-single-table';

    // Create the single table
    const table = new dynamodb.Table(this, 'MastraSingleTable', {
      tableName: tableName,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // Add GSI1
    table.addGlobalSecondaryIndex({
      indexName: 'gsi1',
      partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi1sk', type: dynamodb.AttributeType.STRING },
      // projectionType defaults to ALL in CDK, which is suitable for flexible querying but has cost implications.
    });

    // Add GSI2 (Used by Trace and WorkflowSnapshot)
    table.addGlobalSecondaryIndex({
      indexName: 'gsi2',
      partitionKey: { name: 'gsi2pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi2sk', type: dynamodb.AttributeType.STRING },
      // projectionType defaults to ALL in CDK
    });
  }
}
```

## Enabling TTL (Time To Live)

If you want to use automatic data expiration with DynamoDB TTL, you need to enable it on your table. The `@mastra/dynamodb` package supports configuring TTL per entity type (threads, messages, traces, etc.).

### CloudFormation

Add the `TimeToLiveSpecification` to your table definition:

```yaml
Resources:
  MastraSingleTable:
    Type: AWS::DynamoDB::Table
    Properties:
      # ... other properties ...
      TimeToLiveSpecification:
        AttributeName: ttl # Must match config.ttl.[entity].attributeName (default: 'ttl')
        Enabled: true
```

### AWS CDK

Enable TTL when creating the table:

```typescript
const table = new dynamodb.Table(this, 'MastraSingleTable', {
  // ... other properties ...
  timeToLiveAttribute: 'ttl', // Must match config.ttl.[entity].attributeName (default: 'ttl')
});
```

### AWS CLI

Enable TTL on an existing table:

```bash
aws dynamodb update-time-to-live \
  --table-name mastra-single-table \
  --time-to-live-specification "Enabled=true, AttributeName=ttl"
```

### Configuring TTL in Code

After enabling TTL on your table, configure which entity types should use TTL:

```typescript
const storage = new DynamoDBStore({
  name: 'dynamodb',
  config: {
    tableName: 'mastra-single-table',
    region: 'us-east-1',
    ttl: {
      message: {
        enabled: true,
        defaultTtlSeconds: 30 * 24 * 60 * 60, // 30 days
      },
      trace: {
        enabled: true,
        defaultTtlSeconds: 7 * 24 * 60 * 60, // 7 days
      },
    },
  },
});
```

> **Note**: DynamoDB TTL deletes expired items within 48 hours after expiration. Items remain queryable until actually deleted.

## Using the Table

Once the table is created, you can use it with the DynamoDBStore:

```typescript
import { Memory } from '@mastra/memory';
import { DynamoDBStore } from '@mastra/dynamodb';
import { PineconeVector } from '@mastra/pinecone';

const storage = new DynamoDBStore({
  name: 'dynamodb',
  config: {
    region: 'us-east-1',
    tableName: 'mastra-single-table', // use the name you chose when creating the table
  },
});

const vector = new PineconeVector({
  id: 'dynamodb-pinecone',
  apiKey: process.env.PINECONE_API_KEY,
});

const memory = new Memory({
  storage,
  vector,
  options: {
    lastMessages: 10,
    semanticRecall: true,
  },
});
```

## Note on Local Development

For local development, you can use the AWS DynamoDB Local Docker image:

```bash
docker run -p 8000:8000 amazon/dynamodb-local
```

And then point your DynamoDBStore to the local instance:

```typescript
const storage = new DynamoDBStore({
  name: 'dynamodb',
  config: {
    region: 'us-east-1',
    tableName: 'mastra-single-table',
    endpoint: 'http://localhost:8000', // Local DynamoDB endpoint
  },
});
```
