---
'@mastra/playground-ui': patch
---

Renamed `DataList.Row` (the non-interactive grid wrapper) to `DataList.RowWrapper` for clarity, since the name `Row` was easy to confuse with the interactive row primitives (`.RowButton`, `.RowLink`, `.RowStatic`). The corresponding exported component is now `DataListRowWrapper` (was `DataListRow`).

**Migration**

```tsx
// Before
<DataList.Row>
  <DataList.SelectCell ... />
  <DataList.RowButton ...>...</DataList.RowButton>
</DataList.Row>

// After
<DataList.RowWrapper>
  <DataList.SelectCell ... />
  <DataList.RowButton ...>...</DataList.RowButton>
</DataList.RowWrapper>
```

The `.RowButton`, `.RowLink`, and `.RowStatic` primitives are unchanged.
