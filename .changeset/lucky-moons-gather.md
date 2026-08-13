---
'@mastra/client-js': minor
---

Fixed the streamed display state describing observational-memory progress with the wrong shape. Reading `projectedMessageRemoval` or `projectedReflectionSavings` off a `display_state_changed` event was typed as a number and came back `undefined` at runtime, because the stream carries the full progress state while only `session.state()` returns the flat one.

`display_state_changed` now declares `OMProgressState`, re-exported here so you can type the stream, and the pending figures are read from the buffered pass it carries. `AgentControllerOMProgress` keeps naming the flat slice `session.state()` returns.

```ts
// Before: typed as a number, undefined at runtime.
const freed = event.displayState.omProgress.projectedMessageRemoval;

// After: the stream's own shape.
const freed = event.displayState.omProgress.buffered.observations.projectedMessageRemoval;
```
