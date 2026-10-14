---
'@mastra/playground-ui': patch
---

Added an `info` tone to `DataList` rows. It tints the row blue to set it apart from the others, for example to mark the rows that match the current selection. The tint stays visible on hover and when the row is selected.

```tsx
<DataList.RowLink to={href} variant={isComparable ? 'info' : 'default'}>
  {cells}
</DataList.RowLink>
```
