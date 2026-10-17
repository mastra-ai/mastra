---
'@mastra/playground-ui': minor
---

The trace panel now has an "Add to dataset" button next to "Score trace", with "This span" and "Full trace". Before, adding to a dataset was hidden in the trace actions menu and only took the whole trace.

`onSaveAsDatasetItem` receives a `spanId` when "This span" is picked. Pass it to `TraceAsItemDialog` to save that span's input and output:

```tsx
<TraceDataPanelView onSaveAsDatasetItem={args => setTarget(args)} />

<TraceAsItemDialog traceId={target?.traceId} rootSpanId={target?.rootSpanId} spanId={target?.spanId} />
```
