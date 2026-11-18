---
'@mastra/core': patch
---

`DurableAgent.observe()` now accepts `closeOnSuspend`, so an observer's stream can end when the observed run suspends (for example while waiting for tool approval). Previously the observed stream stayed open at the suspension boundary — a reconnecting client or another replica would hang — because `observe()` never forwarded the option to the underlying durable stream. Passing `closeOnSuspend: true` resolves `fullStream`/`text`/`getFullOutput()` at the suspension boundary, matching `stream()`.

```ts
const { output } = await durableAgent.observe(runId, { closeOnSuspend: true });
for await (const chunk of output.fullStream) {
  send(chunk);
}
// The stream ended at the suspension boundary; resume the run to continue.
```

The default (`false`) keeps the stream open across suspension so a later resume can continue on the same reader, and closing stays observer-scoped, preserving the run's registry entry and replay history for `resume()`/`resumeStream()`. Suspensions the run has already been resumed past are ignored, so replaying a run from its start does not end the stream at an approval that was given long ago.
