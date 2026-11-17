---
'@mastra/playground-ui': major
---

Added `CardInset`, a sunken panel for a list of rows inside a `Card` or a dialog. Rows are separated by dividers.

```tsx
<DialogBody>
  <CardInset>
    <div className="p-3">Source</div>
    <div className="p-3">Schedule</div>
  </CardInset>
</DialogBody>
```

Removed `SectionCard` and `CardHeading`. Build settings sections with the settings components instead:

```tsx
// Before
<SectionCard title="Channels" description="Providers available to publish flows">
  {rows}
</SectionCard>

// After
<SettingsGroup>
  <SettingsTitle info="Providers available to publish flows">Channels</SettingsTitle>
  <SettingsContainer>{rows}</SettingsContainer>
</SettingsGroup>
```
