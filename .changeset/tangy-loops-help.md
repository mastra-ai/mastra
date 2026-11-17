---
'@mastra/playground-ui': major
---

Added `CardInset`, a sunken panel for a list of rows inside a `Card` or a dialog. The panel pads each row and draws a divider between them, so plain elements and `SettingsRow`s both work as rows.

```tsx
<DialogBody>
  <CardInset>
    <div>Source</div>
    <div>Schedule</div>
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
