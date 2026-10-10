---
'@mastra/playground-ui': minor
---

Added a `reorderable` prop to `DataList`. Users can drag header cells, or press Alt+Arrow on a focused header, to move columns. The column order is saved in localStorage under the list's `id`, so you must also pass `id`. Pass `columnKeys` (one stable key per column) when columns can be shown or hidden, so the saved order survives those changes.

```tsx
<DataList columns="10rem 1fr auto" columnKeys={['name', 'input', 'status']} reorderable id="runs">
  ...
</DataList>
```

The traces list (Traces page and agent/workflow Traces tabs) now supports reordering every column, including optional, custom and metadata columns.
