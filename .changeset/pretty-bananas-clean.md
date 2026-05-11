---
'@mastra/playground-ui': minor
---

**Added** new `pill-ghost` variant on `Tabs` and `sticky` prop on `TabList` for sticky tab headers.

**Added** `variant` prop on `Combobox` (`default`, `ghost`, `link`) for flexible trigger styling. Note: this prop existed previously but was a no-op; it now actually drives the trigger appearance, so callers passing `variant` will see updated styles.

**Improved** `EntityHeader` layout — title and children now share a single row with wrapping, and padding is tighter for denser headers.

**Improved** `ScrollArea` to handle vertical/horizontal orientation correctly, preventing forced horizontal scroll when only vertical is needed.

**Improved** `PanelSeparator` with a pill-shaped handle that grows on hover/active for a clearer affordance.

**Removed** `Threads`, `ThreadList`, `ThreadItem`, `ThreadLink`, `ThreadDeleteButton` exports. These were unused outside the playground and have been replaced by a local `thread-list` component in the playground package.
