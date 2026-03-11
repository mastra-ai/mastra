---
'@mastra/s3': minor
---

Added public `client` getter to access the underlying `S3Client` instance directly. Use this when you need S3 features not exposed through the `WorkspaceFilesystem` interface (e.g., presigned URLs, multipart uploads).

```typescript
const s3Client = filesystem.client;
```
