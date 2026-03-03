---
'@mastra/s3': patch
---

feat(s3): add STS sessionToken support for temporary credentials

Added optional `sessionToken` field to `S3FilesystemOptions`, `S3BlobStoreOptions`, `S3MountConfig`, and provider config schemas. This enables using AWS STS temporary credentials (e.g., from IAM role assumption or federated access) with both S3Filesystem and S3BlobStore.
