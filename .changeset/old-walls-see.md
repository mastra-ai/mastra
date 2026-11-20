---
'@mastra/core': minor
---

Added native `Agent` execution on the durable or evented engine while preserving model-output APIs. Configure `durable.executionEngine` on an agent or set `Mastra.durable.executionEngine` for registered agents:

```typescript
const agent = new Agent({
  id: 'support',
  name: 'Support',
  instructions: 'Help customers with their orders.',
  model: 'openai/gpt-6.1-sol',
  durable: { executionEngine: 'durable' },
})

const output = await agent.stream('Where is my order?')
console.log(await output.text)
output.cleanup?.()
```

Native streams retain `MastraModelOutput` APIs and expose durable lifecycle controls. Existing wrapper factories keep their stream result contracts. Release this together with the execution-engine configuration change.
