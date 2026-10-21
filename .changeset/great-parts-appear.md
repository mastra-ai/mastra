---
'@mastra/playground-ui': patch
---

Improved "Save as Dataset Item" so it opens in the same stacked side panel as the trace and score panels. `SaveAsDatasetItemDialog`, `TraceAsItemDialog` and `ScoreAsItemDialog` now take `depth` instead of `level`.

```tsx
// Before
<TraceAsItemDialog traceId={traceId} isOpen={open} onClose={close} level={2} />

// After
<TraceAsItemDialog traceId={traceId} isOpen={open} onClose={close} depth={2} />
```

Added a "Create dataset" option at the top of the Dataset select in "Save as Dataset Item". Pass `renderCreateDatasetDialog` to `SaveAsDatasetItemDialog` or `TraceAsItemDialog` to enable it; the new dataset is selected automatically once created.

```tsx
<TraceAsItemDialog
  traceId={traceId}
  isOpen={open}
  onClose={close}
  renderCreateDatasetDialog={props => <CreateDatasetDialog {...props} />}
/>
```
