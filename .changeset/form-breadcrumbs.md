---
'@mastra/playground-ui': minor
---

Form pages can now show breadcrumbs instead of a back link, and put their side panel on the left. Use them for multi-step create flows such as onboarding, so the page keeps the same way back as the rest of the app and its step list sits before the form.

```tsx
<PageLayout
  variant="form"
  breadcrumbs={<Breadcrumb>{/* Agents / New agent */}</Breadcrumb>}
  title="New agent"
  aside={<Steps>{/* Basics, Instructions, Tools, Review */}</Steps>}
  asidePlacement="start"
>
  {sections}
</PageLayout>
```

A form shows one way back: passing `breadcrumbs` together with `backHref` or `backLabel` is a type error. `asidePlacement` defaults to `end`, so existing forms look the same. A start-side aside hides on narrow screens, where a step list would push the fields down.
