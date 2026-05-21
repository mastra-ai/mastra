---
'@mastra/playground-ui': patch
---

Added `colEnd` and `flushRight` props to `DataList.RowButton` and `DataList.RowLink` so compound rows can host a trailing cell (mirrors the existing `colStart`/`flushLeft` for leading cells). `DataList.Row` now carries the row separator and `.data-list-row` marker itself, so wrapped rows render a full-width separator that extends through any leading or trailing cells. Added an optional `height` prop to `DataList.MonoCell` so non-compact lists can use it without forcing compact padding.
