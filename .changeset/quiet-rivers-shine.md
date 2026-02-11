---
'@mastra/gcs': patch
---

Added `@mastra/gcs` package providing Google Cloud Storage filesystem for Mastra workspaces. Supports credentials as a JSON object, key file path, or Application Default Credentials.

```typescript
import { GCSFilesystem } from '@mastra/gcs';

const fs = new GCSFilesystem({
  bucket: 'my-bucket',
  credentials: { /* service account key */ },
});
```
