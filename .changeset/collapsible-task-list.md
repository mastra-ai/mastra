---
'@mastra/playground-ui': minor
---

Made the task list collapsible and moved its scrolling to the design system scroll area.

Clicking the task list header now collapses it. The collapsed row keeps the completion count and shows the task currently in progress — or the next pending one — with its status icon and color, so the panel can be minimized without losing track of where the agent is. Long lists scroll inside `ScrollArea` (overlay scrollbar, edge fades) instead of a raw `overflow-y` container.

Use `defaultOpen` to render it collapsed:

```tsx
<TaskList tasks={tasks} defaultOpen={false} />
```
