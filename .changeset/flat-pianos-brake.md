---
'@mastra/playground-ui': minor
---

Added `PageHeader.Eyebrow` for a back link above the page title, and fixed `PageHeader.Meta beside` sitting below the title text when the header has a tall icon.

```tsx
<PageHeader>
  <PageHeader.Eyebrow>
    <Link to="/alerts">
      <ArrowLeftIcon aria-hidden />
      Back to alerts
    </Link>
  </PageHeader.Eyebrow>
  <PageHeader.Title>Create alert</PageHeader.Title>
</PageHeader>
```
