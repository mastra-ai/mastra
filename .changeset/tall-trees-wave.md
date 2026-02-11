---
'@mastra/s3': patch
---

Added `@mastra/s3` package providing S3-compatible filesystem for Mastra workspaces. Works with AWS S3, Cloudflare R2, and other S3-compatible services.

```typescript
import { S3Filesystem } from '@mastra/s3';

const fs = new S3Filesystem({
  bucket: 'my-bucket',
  region: 'us-east-1',
  accessKeyId: '...',
  secretAccessKey: '...',
});
```
