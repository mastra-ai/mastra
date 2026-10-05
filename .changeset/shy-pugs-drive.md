---
'@mastra/playground-ui': minor
---

Added `DataList.Group` for blocks of rows that share the list's columns but keep their own hover. A group's row lights only while the pointer is on it or in the gap between two of the group's rows. Headings, buttons, empty states and padding around the rows stay dark, and the highlight never jumps to another group.

```tsx
<DataList columns="auto 1fr auto">
  <DataList.Group aria-label="Open">{openRows}</DataList.Group>
  <DataList.Group aria-label="Closed">{closedRows}</DataList.Group>
</DataList>
```
