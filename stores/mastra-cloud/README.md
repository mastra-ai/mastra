# @mastra/mastra-cloud

Mastra Cloud storage provider - LibSQL-based storage for Mastra Cloud deployments.

This package provides a simplified interface for setting up storage and vector stores for Mastra Cloud deployments. It wraps `@mastra/libsql` to provide a consistent configuration interface.

## Installation

```bash
npm install @mastra/mastra-cloud
# or
pnpm add @mastra/mastra-cloud
```

## Usage

```typescript
import { createCloudStorage } from '@mastra/mastra-cloud';
import { Mastra } from '@mastra/core';

const { storage, vector } = createCloudStorage({
  url: process.env.MASTRA_STORAGE_URL!,
  authToken: process.env.MASTRA_STORAGE_AUTH_TOKEN,
});

// Initialize storage
await storage.init();

// Use with Mastra
const mastra = new Mastra({
  storage,
  // ... other config
});
```

## API

### `createCloudStorage(config: CloudStorageConfig): CloudStorageInstances`

Creates storage and vector instances configured for Mastra Cloud.

#### Parameters

- `config.url` (string, required): The URL of the Mastra Cloud storage database
- `config.authToken` (string, optional): Authentication token for the database
- `config.storageId` (string, optional): ID for the storage instance (default: 'mastra-cloud-storage-libsql')
- `config.vectorId` (string, optional): ID for the vector instance (default: 'mastra-cloud-storage-libsql-vector')

#### Returns

An object containing:

- `storage`: LibSQLStore instance
- `vector`: LibSQLVector instance

## Environment Variables

When deploying to Mastra Cloud, the following environment variables are typically provided:

- `MASTRA_STORAGE_URL`: The URL of your cloud storage database
- `MASTRA_STORAGE_AUTH_TOKEN`: Authentication token for the database

## License

Apache-2.0
