# LANE 3b - Local File Storage (parallel with other Phase 2 lanes)

Create implementation plan for LANE 3b: @mastra/observability-file-local file storage adapter.

Reference the master plan at thoughts/shared/plans/2025-01-23-mastra-admin-master-plan.md for context.

**Dependencies**: LANE 1 (Core Package) must be complete first (for FileStorageProvider interface).

This includes:
- observability/file-local/ package setup
- LocalFileStorage implementing FileStorageProvider interface
- Local filesystem operations:
  - write(path, content) - write files to local filesystem
  - read(path) - read files from local filesystem
  - list(prefix) - list files matching prefix/pattern
  - delete(path) - delete files
  - move(from, to) - move/rename files (for marking as processed)
  - exists(path) - check if file exists
- Directory creation and management
- Atomic write operations (write to temp, then rename)
- File locking considerations

Key interface to implement:
```typescript
export interface FileStorageProvider {
  readonly type: 'local' | 's3' | 'gcs' | string;
  write(path: string, content: Buffer | string): Promise<void>;
  read(path: string): Promise<Buffer>;
  list(prefix: string): Promise<FileInfo[]>;
  delete(path: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}
```

Save plan to: thoughts/shared/plans/2025-01-23-observability-file-storage.md
