---
'@mastra/core': minor
---

Added `HarnessDisplayState` so any UI can read a single state snapshot instead of handling 35+ individual events.

**Why:** Previously, every UI (TUI, web, desktop) had to subscribe to dozens of granular Harness events and independently reconstruct what to display. This led to duplicated state tracking and inconsistencies across UI implementations. Now the Harness maintains a single canonical display state that any UI can read.

**Before:** UIs subscribed to raw events and built up display state locally:

```ts
harness.subscribe((event) => {
  if (event.type === 'agent_start') localState.isRunning = true;
  if (event.type === 'agent_end') localState.isRunning = false;
  if (event.type === 'tool_start') localState.tools.set(event.toolCallId, ...);
  // ... 30+ more event types to handle
});
```

**After:** UIs read a single snapshot from the Harness:

```ts
import type { HarnessDisplayState } from '@mastra/core/harness';

harness.subscribe((event) => {
  const ds: HarnessDisplayState = harness.getDisplayState();
  // ds.isRunning, ds.tokenUsage, ds.omProgress, ds.activeTools, etc.
  renderUI(ds);
});
```
