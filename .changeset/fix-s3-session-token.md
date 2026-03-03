---
'@mastra/s3': patch
---

Add `sessionToken` option to `S3Filesystem` and `S3BlobStore` for AWS temporary credentials.

Previously, users relying on temporary credentials (SSO, AssumeRole, container credentials, etc.) received "Access denied" errors because the session token was never forwarded to the S3 client. The new optional `sessionToken` field is passed through to the AWS SDK credentials, mount config, and provider schemas.
