---
'@mastra/client-js': minor
---

Fixed the streamed display state describing observational-memory progress with the wrong shape. Reading `projectedMessageRemoval` or `projectedReflectionSavings` off a `display_state_changed` event was typed as a number and came back `undefined` at runtime, because the stream carries the full progress state while only `session.state()` returns the flat one.

`display_state_changed` now declares `OMProgressState`, re-exported here so you can type the stream. `AgentControllerOMProgress` keeps naming the flat slice `session.state()` returns, and is now the same type core defines for it.

```ts
import { omProgressSummary } from '@mastra/core/agent-controller';

// Streamed events carry the full state; flatten it to read a pending pass.
const summary = omProgressSummary(event.displayState.omProgress);
```
