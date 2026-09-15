---
'@mastra/playground-ui': patch
---

Added gradient keyboard focus indicators to design-system controls, including sidebar items, search categories, and data-list headers and rows, while preserving positioning, scrolling, search-option highlighting, and disabled-tab explanations. Search categories keep their own keyboard activation, search inputs retain their focus border, and dialog close buttons use icon focus. Data-list header tooltips use standard button focus. Native focusable elements now use a neutral outline.

Controls without a complete custom focus treatment now retain the shared outline, including standalone unstyled fields. Composite fields own their indicator while nested action buttons keep independent focus, and invalid fields retain a separate focus outline. Studio focus styling is centralized in shared components instead of local outline and ring overrides.

Use `Badge.render` to apply badge styling and focus directly to a link:

```tsx
<Badge render={<a href="/workflows" />}>Workflows</Badge>
```
