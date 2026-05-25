---
'@mastra/files-sdk': minor
---

Connect your Mastra workspace to any storage backend — S3, R2, GCS, Azure Blob, Vercel Blob, local filesystem, and more — using a single unified interface. Swap storage providers without changing your workspace code through the new `@mastra/files-sdk` package and `FilesSDKFilesystem` class.

**Usage**

```ts
import { Files } from 'files-sdk';
import { s3 } from 'files-sdk/s3';
import { FilesSDKFilesystem } from '@mastra/files-sdk';

const files = new Files({
  adapter: s3({ bucket: 'my-bucket', region: 'us-east-1' }),
});

const filesystem = new FilesSDKFilesystem({ files });
```

Swap adapters without changing code — just replace `s3()` with `r2()`, `gcs()`, `azure()`, `fs()`, etc.
