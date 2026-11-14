---
'@mastra/core': minor
---

Added staged execution engine configuration on Agent and registered Mastra defaults. Native execution, output types, and recovery remain unchanged; continue using DurableAgent or EventedAgent for durable execution.

Previously, `durable: true` enabled resumable streams without engine configuration:

```ts
const agent = new Agent({
  id: 'support',
  name: 'Support',
  instructions: 'Help the user.',
  model: 'openai/gpt-4o',
  durable: true,
})
```

You can now configure engine policy and stream defaults at stored registration, with explicit Agent settings taking precedence:

```ts
const mastra = new Mastra({
  agents: { support: agent },
  durable: { executionEngine: 'durable', cleanupTimeoutMs: 120_000 },
})
```

`Mastra.durable` accepts an object only. Agent `durable: false` opts out of inherited defaults; `{ executionEngine: false }` keeps streams enabled with plain engine policy. Engine selection is fixed at stored registration or the first invocation. Wrappers permanently replace their inner Agent's durable policy without reconfiguring existing streams or runs.
