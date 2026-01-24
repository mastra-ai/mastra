# LANE 3b-s3 - S3 File Storage (Future, P2)

Create implementation plan for LANE 3b-s3: @mastra/observability-file-s3 S3 file storage adapter.

Reference the master plan at thoughts/shared/plans/2025-01-23-mastra-admin-master-plan.md for context.

**Dependencies**: LANE 1 (Core Package) must be complete (for FileStorageProvider interface).
**Priority**: P2 (Future Enhancement)

This includes:
- observability/file-s3/ package setup
- S3FileStorage implementing FileStorageProvider interface
- AWS S3 operations:
  - write(path, content) - PutObject
  - read(path) - GetObject
  - list(prefix) - ListObjectsV2
  - delete(path) - DeleteObject
  - move(from, to) - CopyObject + DeleteObject
  - exists(path) - HeadObject
- Configuration:
  - AWS credentials (access key, secret, or IAM role)
  - Region
  - Bucket name
  - Optional prefix
  - Endpoint URL (for S3-compatible services like MinIO)
- Streaming support for large files
- Multipart upload for large files
- Error handling and retry logic
- Cost optimization considerations

Key interface to implement:
```typescript
export interface S3FileStorageConfig {
  bucket: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;  // For S3-compatible services
  prefix?: string;    // Optional path prefix
}

export class S3FileStorage implements FileStorageProvider {
  readonly type = 's3' as const;
  constructor(config: S3FileStorageConfig);
  // ... implement FileStorageProvider methods
}
```

Save plan to: thoughts/shared/plans/2025-01-23-observability-file-s3.md
