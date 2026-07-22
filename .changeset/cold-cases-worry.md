---
'@mastra/playground-ui': minor
---

Added separate Sankey node identity, display label, and display value accessors, plus constrained labels with full hover text.

```tsx
<Sankey
  data={records}
  columns={columns}
  getRecordNodeId={(record, column) => String(record[`${column.id}Id`])}
  getRecordNodeLabel={(record, column) => String(record[`${column.id}Label`])}
  getRecordNodeValue={(record, column) => Number(record[`${column.id}Count`])}
>
  <SankeyChart />
</Sankey>
```
