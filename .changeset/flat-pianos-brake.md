---
'@mastra/playground-ui': minor
---

Added `PageHeader.Eyebrow` for a back link above the page title, and fixed `PageHeader.Meta beside` sitting below the title text when the header has a tall icon.

`PageHeader.Icon`, `PageHeader.Action`, and `PageHeader.Meta beside` now center on the first line of the title, including when the title wraps. A header with an icon or action is 32px tall and contains them, so they no longer overflow the header, push the title up, or sit below it. Beside meta no longer shrinks when the title is long.

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
