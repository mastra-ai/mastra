---
'@mastra/playground-ui': minor
---

Added separate Sankey node identity and display label accessors, plus constrained labels with full hover text.

```tsx
<Sankey
  data={records}
  columns={columns}
  getRecordNodeId={(record, column) => String(record[`${column.id}Id`])}
  getRecordNodeLabel={(record, column) => String(record[`${column.id}Label`])}
>
  <SankeyChart />
</Sankey>
```
