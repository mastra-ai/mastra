# @mastra/dynamodb

A DynamoDB storage implementation for Mastra using a single-table design pattern with ElectroDB.

## Features

- Efficient single-table design for all Mastra storage needs
- Based on ElectroDB for type-safe DynamoDB access
- Support for AWS credentials, regions, and endpoints
- Compatible with AWS DynamoDB Local for development
- Thread, Message, Trace, Eval, and Workflow operations
- Optimized for serverless environments

## Installation

```bash
npm install @mastra/dynamodb
# or
pnpm add @mastra/dynamodb
# or
yarn add @mastra/dynamodb
```

## Prerequisites

Before using this package, you need to create a DynamoDB table with the required structure. See [TABLE_SETUP.md](./TABLE_SETUP.md) for detailed instructions on how to set up the table using CloudFormation or AWS CDK.

## Usage

### Basic Usage

```typescript
import { Memory } from '@mastra/memory';
import { DynamoDBStore } from '@mastra/dynamodb';
import { PineconeVector } from '@mastra/pinecone';

// Initialize the DynamoDB storage
const storage = new DynamoDBStore({
  name: 'dynamodb',
  config: {
    region: 'us-east-1',
    tableName: 'mastra-single-table', // Name of your DynamoDB table
  },
});

// Initialize vector store (if using semantic recall)
const vector = new PineconeVector({
  apiKey: process.env.PINECONE_API_KEY,
  environment: process.env.PINECONE_ENVIRONMENT,
  index: process.env.PINECONE_INDEX,
});

// Memory combines storage (like DynamoDBStore) with an optional vector store for recall
// Create memory with DynamoDB storage
const memory = new Memory({
  storage,
  vector,
  options: {
    lastMessages: 10,
    semanticRecall: true,
  },
});
```

### Local Development

For local development, you can use DynamoDB Local:

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

### AWS IAM Permissions

The IAM role or user used by this package needs the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:DescribeTable",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/${YOUR_TABLE_NAME}",
        "arn:aws:dynamodb:*:*:table/${YOUR_TABLE_NAME}/index/*"
      ]
    }
  ]
}
```

## Configuration Options

The `DynamoDBStore` constructor accepts the following configuration options:

| Option               | Type   | Required | Description                                                |
| -------------------- | ------ | -------- | ---------------------------------------------------------- |
| `name`               | string | Yes      | A name for the storage instance                            |
| `config.region`      | string | No       | AWS region (default: 'us-east-1')                          |
| `config.tableName`   | string | Yes      | The name of your DynamoDB table                            |
| `config.endpoint`    | string | No       | Custom endpoint for DynamoDB (e.g., for local development) |
| `config.credentials` | object | No       | AWS credentials (accessKeyId, secretAccessKey)             |

## Architectural Approach

This storage adapter utilizes a **single-table design pattern** leveraging [ElectroDB](https://electrodb.dev/), which is a common and recommended approach for DynamoDB. This differs architecturally from relational database adapters (like `@mastra/pg` or `@mastra/libsql`) that typically use multiple tables, each dedicated to a specific entity (threads, messages, etc.).

Key aspects of this approach:

- **DynamoDB Native:** The single-table design is optimized for DynamoDB's key-value and query capabilities, often leading to better performance and scalability compared to mimicking relational models.
- **External Table Management:** Unlike some adapters that might offer helper functions to create tables via code, this adapter **expects the DynamoDB table and its associated Global Secondary Indexes (GSIs) to be provisioned externally** before use. Please refer to `TABLE_SETUP.md` for detailed instructions using tools like AWS CloudFormation or CDK. The adapter focuses solely on interacting with the pre-existing table structure.
- **Consistency via Interface:** While the underlying storage model differs, this adapter adheres to the same `MastraStorage` interface as other adapters, ensuring it can be used interchangeably within the Mastra `Memory` component.

## Advantage of Single-Table Design

This implementation uses a single-table design pattern with ElectroDB, which offers several advantages within the context of DynamoDB:

1. **Lower cost**: One table means fewer read/write capacity units to provision
2. **Better performance**: Related data is stored together for faster access
3. **Simplified administration**: Only one table to monitor and back up
4. **Reduced complexity**: Consistent access patterns across entities
5. **Transaction support**: Atomic operations across different entity types
