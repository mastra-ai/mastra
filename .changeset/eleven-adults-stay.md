---
'@mastra/playground-ui': patch
---

Added support for trailing cells in `DataList` rows. `DataList.RowButton` and `DataList.RowLink` now accept `colEnd` and `flushRight` (mirrors of the existing `colStart`/`flushLeft`), so a row can sit beside a non-interactive trailing cell (e.g. an actions column) and stay aligned with the header. Rows wrapped in `DataList.Row` now render a full-width separator that extends through the leading and trailing cells. `DataList.MonoCell` also gained an optional `height` prop so non-compact lists can use it without forcing compact padding.

**Usage**

```tsx
<DataList.Row>
  <DataList.RowButton flushLeft flushRight colEnd={-2} onClick={onClick}>
    {/* main row content */}
  </DataList.RowButton>
  <DataList.Cell>
    {/* trailing actions, e.g. icon buttons */}
  </DataList.Cell>
</DataList.Row>

<DataList.MonoCell height="default">long mono text…</DataList.MonoCell>
```
