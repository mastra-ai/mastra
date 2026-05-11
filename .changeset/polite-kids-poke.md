---
'@mastra/playground-ui': minor
---

Added a new `pill` variant on `TabList` with an animated background indicator that slides behind the active trigger. The default `line` variant now animates its underline smoothly between tabs as well. Implemented by migrating the underlying Tabs component from Radix UI to Base UI.

```tsx
// Before — only the line (underline) style was available
<Tabs defaultTab="overview">
  <TabList>
    <Tab value="overview">Overview</Tab>
    <Tab value="projects">Projects</Tab>
  </TabList>
</Tabs>

// After — opt into the new pill style via the `variant` prop on TabList
<Tabs defaultTab="overview">
  <TabList variant="pill">
    <Tab value="overview">Overview</Tab>
    <Tab value="projects">Projects</Tab>
  </TabList>
</Tabs>
```

The public API (`Tabs`, `TabList`, `Tab`, `TabContent`) is unchanged; existing call-sites keep the default `line` variant.
