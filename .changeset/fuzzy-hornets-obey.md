---
'@mastra/e2b': minor
'@mastra/daytona': minor
---

Added Azure Blob sandbox mount support via blobfuse2 in @mastra/e2b and @mastra/daytona. `sandbox.mount(azureBlobFilesystem, '/data')` now works for Azure containers, matching the existing s3fs (S3) and gcsfuse (GCS) integration. Supports authentication via accountKey, sasToken, connectionString, or managed identity/default credentials, and preserves AzureBlobFilesystem prefixes when mounting.

```ts
import { E2BSandbox } from '@mastra/e2b';
import { AzureBlobFilesystem } from '@mastra/azure/blob';

const azureFs = new AzureBlobFilesystem({ container: 'my-data', connectionString: '...' });
const sandbox = new E2BSandbox();
await sandbox.mount(azureFs, '/data');
// Sandbox processes can now read/write /data/* directly against the Azure container.
```
