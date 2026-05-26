---
'@mastra/playground-ui': patch
---

Added `DataList.RowStatic`, a non-interactive row primitive. It renders a row that looks identical to other list rows but does not respond to clicks and shows no hover/focus state — use it alongside `DataList.RowButton` / `DataList.RowLink` when only some rows are clickable (e.g. error or placeholder entries in an otherwise navigable list).

```tsx
{rows.map(row => (row.href ? (
  <DataList.RowLink key={row.id} to={row.href} LinkComponent={Link}>
    {row.cells}
  </DataList.RowLink>
) : (
  <DataList.RowStatic key={row.id}>{row.cells}</DataList.RowStatic>
)))}
```
