---
'@mastra/playground-ui': minor
---

**Added** new `pill-ghost` variant on `Tabs` and `sticky` prop on `TabList` for sticky tab headers.

```tsx
<Tabs defaultTab="overview">
  <TabList variant="pill-ghost" sticky>
    <Tab value="overview">Overview</Tab>
    <Tab value="settings">Settings</Tab>
  </TabList>
</Tabs>
```

**Added** `variant` prop on `Combobox` (`default`, `ghost`, `link`) for flexible trigger styling. Note: this prop existed previously but was a no-op; it now actually drives the trigger appearance, so callers passing `variant` will see updated styles.

```tsx
// Bordered form input (default)
<Combobox options={options} value={value} onValueChange={setValue} />

// Borderless, hover-only surface
<Combobox options={options} value={value} onValueChange={setValue} variant="ghost" />

// Text-only trigger
<Combobox options={options} value={value} onValueChange={setValue} variant="link" />
```

**Improved** `EntityHeader` layout — title and children now share a single row with wrapping, and padding is tighter for denser headers.

**Improved** `ScrollArea` to handle vertical/horizontal orientation correctly, preventing forced horizontal scroll when only vertical is needed.

**Improved** `PanelSeparator` with a pill-shaped handle that grows on hover/active for a clearer affordance.

**Removed** `Threads`, `ThreadList`, `ThreadItem`, `ThreadLink`, `ThreadDeleteButton` exports. These had no consumers outside this repository. Downstream users relying on these exports should compose an equivalent list locally using the underlying DS primitives (`Button`, `Icon`, `Txt`) — the `playground` package now contains a reference implementation under `src/components/thread-list`.

```diff
- import { Threads, ThreadList, ThreadItem, ThreadLink, ThreadDeleteButton } from '@mastra/playground-ui';
+ // Compose locally with @mastra/playground-ui primitives (Button, Icon, Txt)
+ // or copy the reference implementation from the playground package.
```
