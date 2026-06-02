---
'@mastra/core': minor
---

Added experimental Code Mode for agents. `createCodeMode` returns an `execute_typescript` tool plus generated instructions that let an agent write one TypeScript program to orchestrate your tools (batch with `Promise.all`, aggregate, and do math in a real runtime) instead of calling tools one at a time. Tools still run on the host with full validation and tracing; only the orchestration code runs in a workspace sandbox.

```typescript
import { createCodeMode, createTool } from '@mastra/core/tools';

const { tool, instructions } = createCodeMode({
  tools: { getTopProducts, getProductRatings },
});

const agent = new Agent({
  instructions: ['You are a helpful assistant.', instructions],
  tools: { execute_typescript: tool },
});
```
