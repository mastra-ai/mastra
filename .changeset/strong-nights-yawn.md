---
'@mastra/playground-ui': minor
---

Added a lined DataList variant with transparent rows and subtle separators.

```tsx
<DataList columns="1fr auto" variant="lined">
  <DataList.Top>
    <DataList.TopCell>Name</DataList.TopCell>
    <DataList.TopCell>Status</DataList.TopCell>
  </DataList.Top>
  <DataList.RowButton onClick={() => {}}>
    <DataList.Cell>Research Agent</DataList.Cell>
    <DataList.Cell>Active</DataList.Cell>
  </DataList.RowButton>
</DataList>
```
