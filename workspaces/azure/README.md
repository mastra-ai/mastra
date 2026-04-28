# @mastra/azure

Azure Blob Storage filesystem and content-addressable blob store provider for Mastra workspaces.

## Installation

```bash
npm install @mastra/azure
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { AzureBlobFilesystem } from '@mastra/azure/blob';

const workspace = new Workspace({
  filesystem: new AzureBlobFilesystem({
    container: 'my-container',
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
  }),
});

const agent = new Agent({
  name: 'my-agent',
  model: 'anthropic/claude-opus-4-5',
  workspace,
});
```

### Account key

```typescript
const filesystem = new AzureBlobFilesystem({
  container: 'my-container',
  accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
  accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY,
});
```

### Shared access signature

```typescript
const filesystem = new AzureBlobFilesystem({
  container: 'my-container',
  accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
  sasToken: process.env.AZURE_STORAGE_SAS_TOKEN,
});
```

### DefaultAzureCredential

Requires `@azure/identity` to be installed.

```typescript
const filesystem = new AzureBlobFilesystem({
  container: 'my-container',
  accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
  useDefaultCredential: true,
});
```

## Blob Store

`AzureBlobStore` is a content-addressable blob store backed by Azure Blob Storage, used for skill versioning.

```typescript
import { AzureBlobStore } from '@mastra/azure/blob';

const blobs = new AzureBlobStore({
  container: 'my-skill-blobs',
  connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
});
```

## Documentation

For more information, see the [Mastra Workspaces documentation](https://mastra.ai/docs/workspace/overview).
