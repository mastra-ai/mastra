---
'@mastra/playground-ui': minor
---

Redesigned resize handles across the studio. The sidebar and panel separators now show a subtle gradient line that fades in on hover and stays visible for the whole drag — including when the sidebar is collapsed to icons and the cursor moves away from the handle (the handle now captures the pointer during the gesture). `PanelSeparator` accepts a new `variant` prop: `line` (default) fits panels with a visible container edge, `pill` shows a floating pill for panels without one.

```tsx
<PanelSeparator />            // gradient line (default)
<PanelSeparator variant="pill" />  // floating pill
```
