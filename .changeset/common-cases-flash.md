---
'@mastra/playground-ui': minor
---

`PageLayout` no longer has an `actionRow` prop. Put the toolbar in the page body as a child: everything in the body scrolls together, so a filter bar no longer stays put while the page content scrolls under it (as on Metrics). Wrap a list that scrolls on its own in the new `PageLayout.Fill` so it takes the height left under the toolbar and the toolbar stays in view while its rows scroll. Without a `header`, `container` bodies space their children 16px apart. `EmptyState` and `Spinner` fill states now take the remaining space when they sit under a toolbar.

Before:

```tsx
<PageLayout breadcrumbs={crumbs} actionRow={<ActionRow>…</ActionRow>}>
  <AgentsList />
</PageLayout>
```

After:

```tsx
<PageLayout breadcrumbs={crumbs}>
  <ActionRow>…</ActionRow>
  <PageLayout.Fill>
    <AgentsList />
  </PageLayout.Fill>
</PageLayout>
```
