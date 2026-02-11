---
'@mastra/e2b': patch
---

Added `@mastra/e2b` package providing E2B sandbox integration for Mastra workspaces. Supports S3 and GCS filesystem mounting via FUSE inside sandboxes.

```typescript
import { E2BSandbox } from '@mastra/e2b';

const sandbox = new E2BSandbox({ id: 'my-sandbox' });
```
