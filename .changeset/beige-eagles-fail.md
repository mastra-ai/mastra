---
'@mastra/playground-ui': minor
---

Adds `appearance="contained"` to display tabs with a frame around the content panel. Choose `frame="stroke"` for an outlined frame or `frame="inset"` for a filled frame. Tabs that do not fit the available width move into a `+N` dropdown.

Set `attention` on a tab to show a line along its bottom edge. The line pulses briefly, then stays visible until you clear the prop. Users who prefer reduced motion see a static line.

```tsx
<Tabs defaultTab="overview" appearance="contained" frame="inset">
  <TabList>
    <Tab value="overview">Overview</Tab>
    <Tab value="activity">Activity</Tab>
  </TabList>
  <TabContent value="overview">Overview content</TabContent>
  <TabContent value="activity">Activity content</TabContent>
</Tabs>
```
