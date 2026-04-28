---
'@mastra/s3': minor
---

Added AWS credential provider chain support to S3Filesystem and S3BlobStore. You can now pass a `credentials` option with a credential provider function (e.g. `fromNodeProviderChain()`) for auto-refreshing credentials on ECS, Lambda, SSO, or AssumeRole deployments. When all credential options are omitted, the AWS SDK default credential provider chain is used automatically instead of falling back to anonymous access. Static `accessKeyId`/`secretAccessKey` credentials continue to work as before.

**New `credentials` option**

```typescript
import { S3Filesystem } from '@mastra/s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

// Auto-refreshing credentials (ECS task role, SSO, etc.)
const fs = new S3Filesystem({
  bucket: 'my-bucket',
  region: 'us-east-1',
  credentials: fromNodeProviderChain(),
});
```

**SDK default credential chain (no credentials needed)**

```typescript
// Credentials discovered from environment automatically
const fs = new S3Filesystem({
  bucket: 'my-bucket',
  region: 'us-east-1',
});
```

Fixes https://github.com/mastra-ai/mastra/issues/14289
