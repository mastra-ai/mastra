---
'@mastra/playground-ui': minor
'mastra': patch
---

Added animated Sankey layout transitions for column changes. Pass a changing perspective key to opt in:

```tsx
<SankeyChart geometryTransitionKey={columns.map(column => column.id).join(':')} />
```
