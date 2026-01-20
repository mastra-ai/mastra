---
'@mastra/core': major
'@mastra/cloudflare-d1': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/dynamodb': patch
'@mastra/mongodb': patch
'@mastra/upstash': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/pg': patch
---

Renamed MastraStorage to MastraCompositeStore for better clarity. The old MastraStorage name remains available as a deprecated alias for backward compatibility, but will be removed in a future version.

**Migration:**

Update your imports and usage:

```typescript
// Before
import { MastraStorage } from '@mastra/core/storage';

const storage = new MastraStorage({
  id: 'composite',
  domains: { ... }
});

// After
import { MastraCompositeStore } from '@mastra/core/storage';

const storage = new MastraCompositeStore({
  id: 'composite',
  domains: { ... }
});
```

The new name better reflects that this is a composite storage implementation that routes different domains (workflows, traces, messages) to different underlying stores, avoiding confusion with the general "Mastra Storage" concept.
