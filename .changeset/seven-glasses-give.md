---
'@mastra/playground-ui': minor
---

Added `headerActionsSlot` to `TraceSpanPanel` and `TraceDataPanelView` so applications can place actions such as Review Audio alongside the trace controls. Existing panels keep their current behavior when the slot is omitted.

```tsx
<TraceSpanPanel {...tracePanelProps} headerActionsSlot={<button onClick={openRecording}>Review Audio</button>} />
```
