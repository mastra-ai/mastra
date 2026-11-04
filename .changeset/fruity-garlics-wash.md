---
'@mastra/playground-ui': minor
---

Added optional `onPin` and `isPinned` props to `DashboardRenderer` for pinning single widgets. When `onPin` is passed, each widget card shows a pin button next to its title. `isPinned` tells the renderer which widgets are pinned, by id, and `onPin` is called with the widget and the state the user asked for, so your app keeps the pinned widgets.

```tsx
<DashboardRenderer
  definition={definition}
  isPinned={id => pinnedIds.includes(id)}
  onPin={(widget, isPinned) => setPinnedIds(ids => (isPinned ? [...ids, widget.id] : ids.filter(id => id !== widget.id)))}
/>
```
