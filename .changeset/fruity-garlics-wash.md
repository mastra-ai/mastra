---
'@mastra/playground-ui': minor
---

Added optional `onPin` and `isPinned` props to `DashboardRenderer` for pinning single widgets. Pass both together: each widget card then shows a pin button named after the widget, such as "Pin Agent runs". `isPinned` tells the renderer which widgets are pinned, by id, and `onPin` is called with the widget and the state the user asked for, so your app keeps the pinned widgets. A pinned widget keeps its unpin button in view; an unpinned one shows its pin button on hover.

```tsx
<DashboardRenderer
  definition={definition}
  scope="project"
  isPinned={id => pinnedIds.includes(id)}
  onPin={(widget, isPinned) =>
    setPinnedIds(ids =>
      isPinned ? (ids.includes(widget.id) ? ids : [...ids, widget.id]) : ids.filter(id => id !== widget.id),
    )
  }
/>
```
