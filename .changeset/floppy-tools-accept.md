---
'@mastra/core': minor
---

Added `mode: 'catalog'` to `ToolSearchProcessor`. Agents can see available tool IDs and short descriptions while full schemas load only for selected tools.

```ts
const toolSearch = new ToolSearchProcessor({
  tools: allTools,
  mode: 'catalog',
})
```
