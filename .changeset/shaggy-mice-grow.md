---
'@mastra/core': minor
---

Added an opt-in `toolCallConcurrency` strategy that parallelizes safe tool calls when an approval or suspending tool is registered but not actually called in a step.

Previously, registering any tool that requires approval or can suspend forced every tool-call batch to run one at a time, even when the model never called that tool. You can now opt in to resolving concurrency from the tools the model actually called:

**Before**

```ts
// Any registered approval/suspend tool forced sequential execution
const stream = await agent.stream('...', { toolCallConcurrency: 8 });
```

**After**

```ts
// A pure-safe batch runs in parallel; a batch that calls an approval/suspend tool still serializes
const stream = await agent.stream('...', {
  toolCallConcurrency: { limit: 8, strategy: 'called' },
});
```

The default strategy ('available') keeps the existing conservative behavior. This works across both the standard loop and the durable engine. Closes #20100.
