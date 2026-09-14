---
'@mastra/playground-ui': patch
---

Added gradient keyboard focus indicators to design-system controls, including sidebar items and data-list rows, while preserving positioning, scrolling, search-option highlighting, and disabled-tab explanations. Native focusable elements now use a neutral outline.

Use `Badge.render` to apply badge styling and focus directly to a link:

```tsx
<Badge render={<a href="/workflows" />}>Workflows</Badge>
```
