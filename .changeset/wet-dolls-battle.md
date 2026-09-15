---
'@mastra/playground-ui': patch
---

Added gradient keyboard focus indicators to design-system controls, including sidebar items, search categories, and data-list headers and rows, while preserving positioning, scrolling, search-option highlighting, and disabled-tab explanations. Search categories keep their own keyboard activation, search inputs retain their focus border, and dialog close buttons use icon focus. Data-list header tooltips use standard button focus. Native focusable elements now use a neutral outline.

Use `Badge.render` to apply badge styling and focus directly to a link:

```tsx
<Badge render={<a href="/workflows" />}>Workflows</Badge>
```
