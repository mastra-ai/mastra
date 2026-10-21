---
'@mastra/playground-ui': patch
---

Added `scrollable={false}` to DataList so a parent can own scrolling without clipping row effects.

```tsx
<DataList columns="minmax(0,1fr)" fit="container" scrollable={false}>
  {rows}
</DataList>
```
