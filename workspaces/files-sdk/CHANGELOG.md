# @mastra/files-sdk

## 0.2.0-alpha.0

### Minor Changes

- Added @mastra/files-sdk workspace filesystem provider — a unified storage adapter backed by [FilesSDK](https://files-sdk.dev). Supports any FilesSDK adapter (S3, R2, GCS, Azure Blob, Vercel Blob, local filesystem, and more) through a single `FilesSDKFilesystem` class that implements the `WorkspaceFilesystem` interface. ([#17027](https://github.com/mastra-ai/mastra/pull/17027))

  **Usage**

  ```ts
  import { Files } from 'files-sdk';
  import { s3 } from 'files-sdk/s3';
  import { FilesSDKFilesystem } from '@mastra/files-sdk';

  const files = new Files({ adapter: s3({ bucket: 'my-bucket', region: 'us-east-1' }) });

  const filesystem = new FilesSDKFilesystem({ files });
  ```

  Swap adapters without changing code — just replace `s3()` with `r2()`, `gcs()`, `azure()`, `fs()`, etc.

### Patch Changes

- Updated dependencies [[`c35b962`](https://github.com/mastra-ai/mastra/commit/c35b9625c7e854fcfdeee226a3338a750d0ff211), [`4084113`](https://github.com/mastra-ai/mastra/commit/408411370fc48a822e8b616b3b63f9409774e0e9)]:
  - @mastra/core@1.37.0-alpha.8
