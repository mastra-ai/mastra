---
'@mastra/playground-ui': patch
---

Made `TabList size="sm"` a compact 24px tab with 12px labels, for toolbars inside cards. It used to render taller than the default pill tab.

```tsx
<TabList variant="pill-ghost" size="sm">
  <Tab value="busiest">Busiest</Tab>
  <Tab value="time">Time spent</Tab>
</TabList>
```
