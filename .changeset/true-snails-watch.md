---
'@mastra/s3': minor
'@mastra/daytona': minor
'@mastra/e2b': minor
'@mastra/blaxel': minor
---

Added S3 prefix (subdirectory) mount support. You can now mount a specific folder within an S3 bucket instead of the entire bucket by setting the `prefix` option on your S3 filesystem.

**Example:**

```typescript
const fs = new S3Filesystem({
  bucket: 'my-bucket',
  region: 'us-east-1',
  prefix: 'workspace/data',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
});
```

When mounted in a sandbox, only the contents under `workspace/data/` in the bucket will be visible at the mount path. This uses the s3fs `bucket:/path` syntax under the hood.

Closes #15147.
