# @mastra/azure

## 0.2.0-alpha.1

### Minor Changes

- Added `AzureBlobStore`, a content-addressable blob store backed by Azure Blob Storage for skill versioning. Available alongside the existing `AzureBlobFilesystem` from `@mastra/azure/blob`. ([#15853](https://github.com/mastra-ai/mastra/pull/15853))

  ```typescript
  import { AzureBlobStore } from '@mastra/azure/blob';

  const blobs = new AzureBlobStore({
    container: 'my-skill-blobs',
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
  });
  ```

  Supports the same authentication methods as `AzureBlobFilesystem`: connection string, account key, SAS token, `DefaultAzureCredential`, and anonymous access. A matching `azureBlobStoreProvider` descriptor is also exported for MastraEditor.

### Patch Changes

- Updated dependencies [[`28caa5b`](https://github.com/mastra-ai/mastra/commit/28caa5b032358545af2589ed90636eccb4dd9d2f), [`7d056b6`](https://github.com/mastra-ai/mastra/commit/7d056b6ecf603cacaa0f663ff1df025ed885b6c1), [`26f1f94`](https://github.com/mastra-ai/mastra/commit/26f1f9490574b864ba1ecedf2c9632e0767a23bd)]:
  - @mastra/core@1.29.0-alpha.5

## 0.2.0-alpha.0

### Minor Changes

- Add `@mastra/azure`, exporting an Azure Blob Storage `WorkspaceFilesystem` provider via `@mastra/azure/blob` with support for connection string, account key, SAS token, `DefaultAzureCredential`, and anonymous auth, plus prefix namespacing and read-only mode. ([#15217](https://github.com/mastra-ai/mastra/pull/15217))

### Patch Changes

- Updated dependencies [[`c04417b`](https://github.com/mastra-ai/mastra/commit/c04417ba0a2e4ded66da4352331ef29cd4bd1d79), [`cf25a03`](https://github.com/mastra-ai/mastra/commit/cf25a03132164b9dc1e5dccf7394824e33007c51), [`ba6b0c5`](https://github.com/mastra-ai/mastra/commit/ba6b0c51bfce358554fd33c7f2bcd5593633f2ff)]:
  - @mastra/core@1.29.0-alpha.3
