---
'@mastra/playground-ui': minor
---

Added visual variants to the semantic `Table` component and reused those table primitives in markdown rendering.

Use `variant="striped"` or `variant="lined"` when a native HTML table should match the denser list treatments.

```tsx
<Table size="small" variant="striped">
  <Thead>
    <Th>Name</Th>
    <Th>Status</Th>
  </Thead>
  <Tbody>
    <Row>
      <Cell>Dataset row</Cell>
      <Cell>Active</Cell>
    </Row>
  </Tbody>
</Table>
```
