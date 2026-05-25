---
'@mastra/files-sdk': minor
---

Added @mastra/files-sdk workspace filesystem provider — a unified storage adapter backed by [FilesSDK](https://files-sdk.dev). Supports any FilesSDK adapter (S3, R2, GCS, Azure Blob, Vercel Blob, local filesystem, and more) through a single `FilesSDKFilesystem` class that implements the `WorkspaceFilesystem` interface.

**Usage**

```ts
import { Files } from 'files-sdk';
import { s3 } from 'files-sdk/s3';
import { FilesSDKFilesystem } from '@mastra/files-sdk';

const files = new Files({ adapter: s3({ bucket: 'my-bucket', region: 'us-east-1' }) });

const filesystem = new FilesSDKFilesystem({ files });
```

Swap adapters without changing code — just replace `s3()` with `r2()`, `gcs()`, `azure()`, `fs()`, etc.
