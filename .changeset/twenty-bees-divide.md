---
'@mastra/dsql': minor
---

Added Amazon Aurora DSQL storage provider with IAM authentication support.

Enables storing threads, messages, workflows, traces, and agent data in Amazon Aurora DSQL clusters.

```typescript
import { DSQLStore } from '@mastra/dsql';

const storage = new DSQLStore({
  id: 'my-dsql-store',
  host: 'abc123.dsql.us-east-1.on.aws',
});

await storage.init();
```

Related: #10929
