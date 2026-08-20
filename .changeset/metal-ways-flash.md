---
'@mastra/playground-ui': minor
---

Added `NoticeAlt` and `SettingsSectionAlt` for status messaging and composable settings layouts.

```tsx
<NoticeAlt variant="info" surface="grainy-fade" title="Read-only dataset">
  <NoticeAlt.Message>Clone this dataset before making changes.</NoticeAlt.Message>
</NoticeAlt>

<SettingsSectionAlt title="General">
  <SettingsSectionAlt.Row label="Telemetry" description="Share anonymous usage data.">
    <Switch />
  </SettingsSectionAlt.Row>
</SettingsSectionAlt>
```
