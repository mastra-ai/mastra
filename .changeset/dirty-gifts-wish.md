---
'@mastra/gcs': minor
---

Added public `storage` and `bucket` getters to access the underlying Google Cloud Storage instances directly. Use these when you need GCS features not exposed through the `WorkspaceFilesystem` interface.

```typescript
const gcsStorage = filesystem.storage;
const gcsBucket = filesystem.bucket;
```
