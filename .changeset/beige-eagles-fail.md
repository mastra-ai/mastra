---
'@mastra/playground-ui': minor
---

Adds `appearance="contained"` with a thin stroke or `frame="inset"` surface frame. The inset selection slides between tabs and joins the content panel with curved shoulders. Overflow tabs are available through a compact dropdown.

Set `attention` on a tab to pulse its full surface briefly, then retain a tint until the caller clears it. Reduced motion disables the pulse. Storybook controls demonstrate overflow, closable tabs, and attention.

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
