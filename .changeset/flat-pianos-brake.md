---
'@mastra/playground-ui': minor
---

Added `PageHeader.Eyebrow` for a back link above the page title, and fixed `PageHeader.Meta beside` sitting below the title text when the header has a tall icon.

`PageHeader.Icon` and `PageHeader.Action` now center on the title line. Icons and controls up to 32px no longer push the title up or make the header taller, and a large action button no longer sits below the title.

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
