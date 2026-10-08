---
'@mastra/playground-ui': minor
---

Added a primaryActions slot to PageLayout so essential controls can stay visible in compact application headers.

Applications that customize the header through `PageLayoutHeaderContext` can render `primaryActions` directly while grouping secondary `headerActions` in an overflow menu. Existing `headerActions` continue to work unchanged.

```tsx
<PageLayout breadcrumbs={<Breadcrumbs />} headerActions={<SecondaryActions />} primaryActions={<ConfigButton />}>
  <Chat />
</PageLayout>
```
