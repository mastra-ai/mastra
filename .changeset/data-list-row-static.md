---
'@mastra/playground-ui': patch
---

Added `DataList.RowStatic`, a non-interactive row primitive. Use it when a row should *display* like a regular row but has no link target or click handler (e.g. error or placeholder entries in an otherwise navigable list). Cells align with the rest of the list because the row uses the same column tracks, gap, and padding as `DataList.RowButton` / `DataList.RowLink`, but the row skips the cursor-pointer + hover/focus visuals that signal interactivity.

```tsx
{rows.map(row => (row.href ? (
  <DataList.RowLink key={row.id} to={row.href} LinkComponent={Link}>
    {row.cells}
  </DataList.RowLink>
) : (
  <DataList.RowStatic key={row.id}>{row.cells}</DataList.RowStatic>
)))}
```
