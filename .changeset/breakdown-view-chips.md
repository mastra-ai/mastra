---
'@mastra/playground-ui': minor
---

Added a `chips` variant to `TabList`: separate outlined pills with the open one filled, no track and no sliding indicator, so picking one swaps at once. Chips that don't fit fold into a "+N" menu after the last one that does, with the open chip always in the row.

```tsx
<Tabs value={view} defaultTab={view} onValueChange={setView}>
  <TabList variant="chips" size="sm">
    <Tab value="agents">Agents</Tab>
    <Tab value="tools">Tools</Tab>
  </TabList>
</Tabs>
```

The metrics Breakdown card and dashboard tables with several views now list their views as chips under the title ("Agents", "Tools", …) instead of a dropdown in the title: every view that fits is one click away, and the rest are in the "+N" menu. `CardViewTabs` is exported from `domains/metrics/components` for other cards with several views.
