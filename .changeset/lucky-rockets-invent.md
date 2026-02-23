---
'@mastra/core': minor
---

Added HarnessDisplayState — a canonical display state maintained by the Harness class. Any UI can now call harness.getDisplayState() to get a read-only snapshot of what to display, instead of interpreting 35+ raw event types individually.

**New types:** HarnessDisplayState, ActiveToolState, ActiveSubagentState, OMProgressState, OMStatus, OMBufferedStatus

**New method:** getDisplayState() — returns a read-only snapshot of the current display state

**New event:** display_state_changed — emitted alongside every other event after display state is updated

**Example usage:**

```ts
import { Harness } from '@mastra/core/harness';
import type { HarnessDisplayState } from '@mastra/core/harness';

harness.subscribe(event => {
  const ds: HarnessDisplayState = harness.getDisplayState();
  // ds.isRunning, ds.tokenUsage, ds.omProgress, ds.activeTools, etc.
});
```
