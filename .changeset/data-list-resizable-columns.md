---
'@mastra/playground-ui': minor
---

Added a `resizable` prop to `DataList`. Drag (or use the arrow keys on) the handle at the edge of a header cell to resize a column; double-click to reset. Widths are remembered per list `id`.

Column reordering and resizing now also work in lists with a leading selection column. Pass `fixed` to a `DataList.TopCell` to keep it out of reordering and resizing.
