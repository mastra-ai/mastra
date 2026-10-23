---
'@mastra/s3': patch
---

Added Neon Object Storage detection to `S3Filesystem`. When the endpoint is a Neon branch storage endpoint, the filesystem now uses the `neon` icon and the `Neon Object Storage` display name, so Studio and agent instructions name the provider correctly.

```typescript
import { S3Filesystem } from '@mastra/s3';

const filesystem = new S3Filesystem({
  bucket: 'agent-files',
  region: process.env.AWS_REGION!,
  endpoint: process.env.AWS_ENDPOINT_URL_S3, // from `neon env pull`
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

filesystem.icon; // 'neon'
filesystem.displayName; // 'Neon Object Storage'
```
