---
'@mastra/inngest': patch
'@mastra/core': patch
---

Fixed Inngest durable agents persisting the agent's system prompt in every step result of workflow snapshots. Inngest agent workflows now apply the same snapshot pruning as the core `DurableAgent`, so instructions are only kept on the run input. `pruneAgentLoopSnapshot` is now exported from `@mastra/core/agent/durable`.

```ts
import { pruneAgentLoopSnapshot } from '@mastra/core/agent/durable';
import { createWorkflow } from '@mastra/core/workflows';

const workflow = createWorkflow({
  id: 'my-agent-loop',
  inputSchema,
  outputSchema,
  options: { pruneSnapshot: pruneAgentLoopSnapshot },
});
```
