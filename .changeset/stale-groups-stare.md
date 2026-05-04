---
'@mastra/core': minor
---

Added `CostGuardProcessor`, a built-in processor for enforcing monetary cost limits across agent runs. Supports run, resource, and thread scopes with configurable time windows (default 7 days), blocking or warning when limits are reached. Also added `onViolation` callback to the base `Processor` interface for generalized violation handling across all processors.

```typescript
import { Agent } from '@mastra/core/agent'
import { CostGuardProcessor } from '@mastra/core/processors'

const costGuard = new CostGuardProcessor({
  maxCost: 5.0,
  scope: 'resource',
  window: '24h',
  strategy: 'block',
})

costGuard.onViolation = ({ processorId, message, detail }) => {
  console.log(`[${processorId}] ${message}`, detail)
}

const agent = new Agent({
  name: 'my-agent',
  model: 'openai/gpt-5-nano',
  inputProcessors: [costGuard],
})
```
