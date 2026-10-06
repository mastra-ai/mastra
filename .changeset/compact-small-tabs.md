---
'@mastra/playground-ui': patch
---

Made `TabList size="sm"` a compact 24px tab with 12px labels, for toolbars inside cards. Before, `sm` was about the same height as the default tab. To keep the previous look, use `size="md"` (the default). The span and trace data panels and `ThreadTrace.TabList` now use `md`.

```tsx
<TabList variant="pill-ghost" size="sm">
  <Tab value="busiest">Busiest</Tab>
  <Tab value="time">Time spent</Tab>
</TabList>
```
