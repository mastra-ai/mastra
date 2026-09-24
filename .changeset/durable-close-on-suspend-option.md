---
'@mastra/core': minor
'@mastra/inngest': minor
---

Added a `closeOnSuspend` option to durable agent `stream()` and `resume()`, so callers can end the stream when a tool suspends.

Previously, the stream returned by `DurableAgent.stream()` (and `createInngestAgent().stream()`) stayed open after a tool suspended for approval or user input, and there was no public way to change that. Loops over `fullStream` hung, so integrations like AG-UI could not emit `RUN_FINISHED`.

Pass `closeOnSuspend: true` to close the stream at the suspension boundary, matching non-durable `Agent.stream()`:

```ts
const result = await durableAgent.stream('hi', { closeOnSuspend: true });
for await (const chunk of result.fullStream) {
  // loop ends after the tool-call-suspended chunk
}
```

The default is unchanged (`false`): the stream stays open across suspension.
