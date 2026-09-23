---
'@mastra/playground-ui': minor
---

Added a `narrow` variant and an optional `header` slot to `PageLayout`. The `narrow` variant centers the page body in a wide max-width column; `header` renders a page-level header (such as `PageHeader`) inside the body container, above the content.

```tsx
<PageLayout variant="narrow" breadcrumbs={crumbs} header={<PageHeader>…</PageHeader>}>
  {content}
</PageLayout>
```
