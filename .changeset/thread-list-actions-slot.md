---
'@mastra/playground-ui': minor
---

Added an `actions` slot to `ThreadListItem` so a thread row can show custom controls, such as a menu with Rename and Delete. The controls appear on hover or focus, and stay visible while a popup they own is open.

```tsx
<ThreadListItem href="/chat/1" actions={<ThreadActionsMenu />}>
  Trip planning
</ThreadListItem>
```
