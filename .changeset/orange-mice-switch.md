---
'@mastra/playground-ui': minor
---

Added `AddDatasetItemDialog`, a three-step dialog for creating dataset items: input and ground truth first, then optional tool mocks, then optional request context and expected trajectory. Tool mocks and request context are written as JSON, so any mock or context value the runtime supports can be declared. Trajectory steps can be reordered, and tool steps offer the target agent's tools as a picker.

The dialog can be prefilled (`initialInput`, `initialGroundTruth`, `initialToolMocks`, `initialTrajectory`), and when no `datasetId` is given it asks which dataset to add to, with an optional "Create dataset" entry.

`TraceAsItemDialog` now opens this dialog, prefilled from the trace's input, output, recorded tool calls and trajectory. Recorded details the editor doesn't show, such as tool results, are kept on each step. Its `depth` prop was removed, since the dialog no longer stacks as a side panel.

```tsx
<AddDatasetItemDialog
  open={open}
  onOpenChange={setOpen}
  initialInput={JSON.stringify(input, null, 2)}
  source={{ type: 'trace', referenceId: traceId }}
/>
```
