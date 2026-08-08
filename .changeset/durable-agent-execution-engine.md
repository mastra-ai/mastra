---
'@mastra/core': minor
---

Added a provider-neutral durable-agent execution engine contract. External engines can now own durable start, resume, recovery, abort, and status operations while Mastra continues to own agent preparation, streaming, memory, tools, approvals, and cleanup.

```ts
import { createDurableAgent } from '@mastra/core/agent/durable'

const durableAgent = createDurableAgent({
  agent,
  executionEngine,
})
```
