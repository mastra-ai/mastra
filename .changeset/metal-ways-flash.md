---
'@mastra/playground-ui': minor
---

Added `SettingsSectionAlt` for composable, flat settings layouts.

```tsx
<SettingsSectionAlt title="Security">
  <SettingsSectionAlt.Row label="Two-factor authentication" description="Require a verification code when signing in.">
    <Switch />
  </SettingsSectionAlt.Row>
</SettingsSectionAlt>
```
