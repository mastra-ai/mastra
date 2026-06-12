---
"@mastra/core": patch
---

Add `persistPartialOnAbort` option to preserve partial streamed assistant output when a request is aborted.

Previously, aborting an agent stream (e.g. user clicking "stop") caused all streamed output to be lost on refresh because `memory.saveMessages` was skipped entirely. The new opt-in option saves partial output when non-empty text was already streamed to the client.

```ts
const stream = await agent.stream('Hello', {
  persistPartialOnAbort: true,  // save partial output if user aborts
  abortSignal: controller.signal,
});
```

Defaults to `false` — existing abort behavior is fully preserved when the option is not set.
