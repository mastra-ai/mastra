---
'@mastra/playground-ui': patch
---

Added a `factory` variant to the `SettingsRow` component so settings rows can render the denser card-row layout (row padding, 12px description text) instead of only the studio spacing.

```tsx
<SettingsRow variant="factory" label="Auto-approve tools" description="Run tool calls without asking">
  <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
</SettingsRow>
```
