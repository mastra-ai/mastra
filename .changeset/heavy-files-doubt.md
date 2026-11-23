---
'@mastra/core': patch
---

Added `stopCause` to an agent's `finish` chunk. It says why the agent loop stopped calling the model, which `stepResult.reason` can't: every run that ends on a tool call reports `'tool-calls'`, whether it ran out of `maxSteps`, stopped on a client tool, matched `stopWhen` or was ended by `onIterationComplete`. The field is on the chunk from `stream()` and on the copies that `subscribeToThread()` subscribers receive. Fixes [#29612](https://github.com/mastra-ai/mastra/issues/29612).

```ts
const subscription = await agent.subscribeToThread({ threadId, resourceId })

for await (const chunk of subscription.stream) {
  if (chunk.type === 'finish' && chunk.payload.stopCause === 'max_steps') {
    // The run used its whole step budget while the model still wanted to call tools
  }
}
```

Also fixed traces reporting `max_steps` for runs that were stopped on purpose on their last allowed step. When `onIterationComplete` returns `{ continue: false }` there, with or without `feedback`, `Agent` traces now report `iteration_hook`, as durable agents already did. When a `stopWhen` condition matches there, every agent now reports `stop_condition`.
