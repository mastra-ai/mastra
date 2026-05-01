---
'@mastra/playground-ui': minor
---

Removed `<Alert>` in favor of `<Notice>`. The two components had significant visual and behavioral overlap; `<Notice>` is now the single banner primitive and supports every previous `<Alert>` use case.

`<Notice>` is also redesigned with a flatter API: `title` and `icon` are now props, each variant ships a default icon, an optional `action` prop renders a button aligned to the title, and a new `note` variant has been added alongside `warning`, `destructive`, `info`, and `success`. Theme tokens (`notice-warning`, `notice-destructive`, `notice-info`, `notice-success`, `notice-note`) replace the previous hardcoded colors.

**Migration**

```tsx
// Before
<Alert variant="warning">
  <AlertTitle>Provider not connected</AlertTitle>
  <AlertDescription as="p">Set the API key environment variable.</AlertDescription>
</Alert>

// After
<Notice variant="warning" title="Provider not connected">
  <Notice.Message>Set the API key environment variable.</Notice.Message>
</Notice>
```
