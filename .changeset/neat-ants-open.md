---
'@mastra/inngest': minor
---

Added `connect()` to support Inngest Connect for Mastra workflows. Use this when running workflow execution in a dedicated long-running worker process that should not expose an inbound HTTP endpoint:

```ts
import { connect } from '@mastra/inngest/connect';

await connect({
  mastra,
  inngest,
  instanceId: 'worker-1',
  maxWorkerConcurrency: 10,
});
```

`connect()` uses the same Mastra workflow functions as `serve()`, including nested and cron workflows. `serve()` is unchanged.
