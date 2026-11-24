---
'@mastra/core': patch
---

Allow native durable agents to configure journal `storageVersion` and `maxSteps`. Warn when inherited durable execution cannot carry request context values or call options across processes. Keep late observer response messages complete when replay is disabled, and report output processor rewrites in final response messages and on the correct steps after feedback continuation.

```ts
import { Agent } from '@mastra/core/agent';

const agent = new Agent({
  id: 'support',
  name: 'Support',
  instructions: 'Help customers with their orders.',
  model: 'openai/gpt-5-mini',
  durable: { executionEngine: 'default', storageVersion: 2, maxSteps: 8 },
});
```
