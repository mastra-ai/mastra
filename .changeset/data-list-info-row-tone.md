---
'@mastra/playground-ui': patch
---

Added an `info` tone to `DataList` rows. It adds a faint blue tint to set a row apart from the others, for example to mark the rows that match the current selection. Hover and selection still show through the tint.

```tsx
<DataList.RowLink to={href} variant={isComparable ? 'info' : 'default'}>
  {cells}
</DataList.RowLink>
```
