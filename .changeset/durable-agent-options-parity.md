---
'@mastra/core': minor
---

Brought `DurableAgent.stream()` to parity with `Agent.stream()` for the full `AgentExecutionOptions` surface, so the same call works on both.

**What's new**

`DurableAgent.stream()` now honors these options that were previously dropped or silently coerced:

- Full `modelSettings` (was: only `temperature`) — `maxOutputTokens`, `topP`, `topK`, `presencePenalty`, `frequencyPenalty`, `stopSequences`, `seed`, `headers`
- `stopWhen`, `prepareStep`, `isTaskComplete`, `transform`
- Per-call `instructions` and `system`
- `disableBackgroundTasks`, `tracingOptions`, `actor`
- Function-form `requireToolApproval(toolName, args, …)` (was: coerced to "approve all" — now evaluated per tool call)
- New callbacks: `onAbort` and `onIterationComplete` (joining the existing `onChunk` / `onStepFinish` / `onFinish` / `onError` / `onSuspended` bridge)

**Example**

The same options that work on `Agent.stream()` now work on `DurableAgent.stream()`:

```ts
const durable = createDurableAgent({ agent, pubsub });

await durable.stream('Plan the trip', {
  modelSettings: { temperature: 0.2, maxOutputTokens: 500, topP: 0.9 },
  stopWhen: ({ steps }) => steps.length >= 3,
  prepareStep: ({ stepNumber }) => ({
    activeTools: stepNumber === 0 ? ['search'] : ['book'],
  }),
  requireToolApproval: ({ toolName }) => toolName === 'book',
  onIterationComplete: ({ iteration }) => console.log('iter', iteration),
});
```
