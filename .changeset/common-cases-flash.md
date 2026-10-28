---
'@mastra/playground-ui': minor
---

`PageLayout` no longer has `actionRow` or `header` props. Put toolbars and page headers in the page body as children: everything in the body scrolls together, so a filter bar no longer stays put while the page content scrolls under it (as on Metrics). Wrap a list that scrolls on its own in the new `PageLayout.Fill` so it takes the height left under the toolbar. `container` and `narrow` bodies now space their children 16px apart.

Before:

```tsx
<PageLayout breadcrumbs={crumbs} actionRow={<ActionRow>…</ActionRow>} header={<PageHeader>…</PageHeader>}>
  <AgentsList />
</PageLayout>
```

After:

```tsx
<PageLayout breadcrumbs={crumbs}>
  <PageHeader>…</PageHeader>
  <ActionRow>…</ActionRow>
  <PageLayout.Fill>
    <AgentsList />
  </PageLayout.Fill>
</PageLayout>
```
