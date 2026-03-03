---
'@mastra/s3': patch
---

Temporary AWS credentials (SSO, AssumeRole, container credentials) no longer cause "Access denied" errors. Both `S3Filesystem` and `S3BlobStore` now accept an optional `sessionToken` field that is forwarded to the AWS SDK.

```ts
new S3Filesystem({ bucket, region, accessKeyId, secretAccessKey, sessionToken })
```
