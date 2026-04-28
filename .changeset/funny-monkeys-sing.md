---
'@mastra/azure': minor
---

Added `AzureBlobStore`, a content-addressable blob store backed by Azure Blob Storage for skill versioning. Available alongside the existing `AzureBlobFilesystem` from `@mastra/azure/blob`.

```typescript
import { AzureBlobStore } from '@mastra/azure/blob';

const blobs = new AzureBlobStore({
  container: 'my-skill-blobs',
  connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
});
```

Supports the same authentication methods as `AzureBlobFilesystem`: connection string, account key, SAS token, `DefaultAzureCredential`, and anonymous access. A matching `azureBlobStoreProvider` descriptor is also exported for MastraEditor.
