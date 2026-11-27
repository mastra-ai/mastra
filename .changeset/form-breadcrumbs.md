---
'@mastra/playground-ui': minor
---

Form pages can now show breadcrumbs instead of a back link. Use this for multi-step create flows such as onboarding, so the page keeps the same way back as the rest of the app.

```tsx
<PageLayout variant="form" breadcrumbs={<Breadcrumb>{/* Agents / New agent */}</Breadcrumb>} title="New agent">
  {sections}
</PageLayout>
```

A form shows one way back: passing `breadcrumbs` together with `backHref` or `backLabel` is a type error.
