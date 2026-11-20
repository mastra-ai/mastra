---
'@mastra/playground-ui': minor
---

`TabList` takes `overflow="menu"`: tabs that don't fit fold into a "+N" menu after the last one that does, with the open tab always in the row. It was only available on contained tabs; the default still scrolls.

```tsx
<Tabs defaultTab="agents">
  <TabList variant="pill" size="sm" overflow="menu">
    <Tab value="agents">Agents</Tab>
    <Tab value="tools">Tools</Tab>
  </TabList>
</Tabs>
```

Dashboard tables with several views, such as the Metrics page's Breakdown, now list them as pill tabs under the title ("Agents", "Tools", …) instead of a dropdown in the title: every view that fits is one click away, the rest are in the "+N" menu, and switching is instant. The standalone `BreakdownCard` keeps its title menu.
