---
'@mastra/playground-ui': minor
---

Added a `PageShell` layout component that composes `PageLayout` and `PageHeader` for a standard page with a title, optional icon, description, meta, and action.

```tsx
<PageShell
  title="Research agent"
  icon={<BotIcon />}
  description="Searches trusted sources."
  meta={<Badge variant="green">Read only</Badge>}
  action={<Button size="sm">Edit</Button>}
>
  <MyPageContent />
</PageShell>
```
