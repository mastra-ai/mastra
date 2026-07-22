---
'@mastra/playground-ui': minor
---

Added separate Sankey node identity, display label, display value, and layout weight accessors, plus constrained labels with full hover text. Stable layout weights can now keep node positions fixed while current record weights animate bar and ribbon sizes.

```tsx
<Sankey
  data={records}
  columns={columns}
  getRecordNodeId={(record, column) => String(record[`${column.id}Id`])}
  getRecordNodeLabel={(record, column) => String(record[`${column.id}Label`])}
  getRecordNodeValue={(record, column) => Number(record[`${column.id}Count`])}
  getRecordWeight={record => Number(record.count)}
  getRecordLayoutWeight={record => Number(record.windowMaxCount)}
>
  <SankeyChart />
</Sankey>
```
