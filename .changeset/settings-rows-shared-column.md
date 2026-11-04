---
'@mastra/playground-ui': minor
---

Settings rows line up across Studio, Factory and Platform. In a `SettingsRow`, text inputs and selects now fill a shared 16rem column on the right, so their left edges line up row to row, and switches and buttons end at the right edge. Pass `controlPlacement="below"` (on `SettingsRow` or `SettingsFieldsetRow`) to put a control under its label at full width, for forms with several controls. A `SettingsFieldsetRow` that isn't the last row now keeps its divider.

New pieces for settings pages:

- `SettingsTitle` takes `info`, shown as a tooltip on the title (it gets a dotted underline on hover), for section descriptions that are worth keeping but don't need to sit on the page.
- `SettingsAddRow` and `SettingsEmptyRow` put a list's add action and empty state inside its `SettingsContainer`, as its last row.
- `CopyInput` (`@mastra/playground-ui/components/CopyInput`) shows a read-only value, like an ID, with a copy button.
- `PageLayout` takes `variant="form"`: `narrow` at 768px, for settings and other form pages.

```tsx
<SettingsGroup>
  <SettingsHeader>
    <SettingsTitle info="Sent with every request the studio makes.">Request headers</SettingsTitle>
  </SettingsHeader>
  <SettingsContainer>
    {headers.length === 0 ? <SettingsEmptyRow>No request headers</SettingsEmptyRow> : rows}
    <SettingsAddRow onClick={addHeader}>Add header</SettingsAddRow>
  </SettingsContainer>
</SettingsGroup>
```
