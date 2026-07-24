---
'@mastra/core': minor
---

Added first-class guardrail policies for agents.

Use the new `guardrails` config to enable safety groups without wiring processors manually:

```ts
import { Agent } from '@mastra/core/agent'

const agent = new Agent({
  id: 'support-agent',
  name: 'Support Agent',
  instructions: 'You are a helpful support agent.',
  model,
  guardrails: {
    sensitivity: 'medium',
    streaming: {
      checkEvery: 'sentence',
      lookback: 'medium',
    },
    security: true,
    privacy: true,
  },
})
```

Added policy helpers such as `defineGuardrailPolicy()` and `evaluateGuardrailPolicy()` so teams can reuse policies and test them against sample input before attaching them to an agent. Policies support semantic `sensitivity` levels for supported checks, with numeric `threshold` available for advanced tuning. Output guardrails also support semantic stream windowing through policy-level `streaming.checkEvery` and `streaming.lookback` options.
