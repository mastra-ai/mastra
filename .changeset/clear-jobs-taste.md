---
'@mastra/playground-ui': minor
---

Added composable PageHeader slots, including metadata that can sit below or beside the title.

```tsx
<PageHeader>
  <PageHeader.Title>production</PageHeader.Title>
  <PageHeader.Meta placement="beside">Live</PageHeader.Meta>
  <PageHeader.Action>Edit</PageHeader.Action>
</PageHeader>
```
