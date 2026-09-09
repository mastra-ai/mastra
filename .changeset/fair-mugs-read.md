---
'@mastra/playground-ui': minor
---

Added SettingsLayout header options for pages that need more context or manage their own content layout. Use `titleAccessory` for content beside the title, `description` for supporting text, and `variant="header"` when the page already provides its content container. Existing layouts remain unchanged when these props are omitted.

```tsx
<SettingsLayout
  title="Deployment"
  titleAccessory={<Badge size="sm">Studio</Badge>}
  description="Jan 1, 2025 07:00:00"
  variant="header"
>
  <DeploymentDetails />
</SettingsLayout>
```
