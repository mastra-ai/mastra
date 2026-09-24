---
'@mastra/core': major
'@mastra/inngest': major
---

DurableAgent `stream()` now closes the caller stream at the suspension boundary by default

Previously, when a durable agent (`@mastra/core` `DurableAgent` or `@mastra/inngest` `createInngestAgent`) suspended for a tool that requires approval or human input, the stream returned by `stream()` stayed open indefinitely. Callers awaiting `fullStream`, `text`, or `getFullOutput()` would hang, which blocked AG-UI's `RUN_FINISHED` signal and left A2A tasks unable to complete. The internal `CLOSE_ON_SUSPEND` symbol that controlled this could not be set by `stream()` callers.

`stream()` and `resume()`/`resumeStream()` now expose a public `closeOnSuspend?: boolean` option that **defaults to `true`**. With the default, the stream resolves at the suspension boundary — matching non-durable `Agent.stream()` and `Workflow.stream()`.

**Breaking change / migration.** If you rely on reading a single stream across a suspension and a later resume (for example, collecting multiple approvals from parallel tool delegations on one reader), pass `closeOnSuspend: false` to keep the old behavior:

```ts
// Old default behavior — stream stays open across suspension
const result = await agent.stream('...', { closeOnSuspend: false });
```

`resumeStream()`/`resume()` always return a fresh stream regardless of this option, so resuming a suspended run is unchanged. Internal `generate()`/`resumeGenerate()` already closed on suspend and are unaffected.
