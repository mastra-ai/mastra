---
'@mastra/playground-ui': minor
---

Added SettingsRow primitive for label/description + control rows in settings pages. Markup mirrors the existing platform settings row pattern (flex justify-between with title + optional description on the left, control on the right) so consumers can adopt it without visual regressions.

Removed the redundant SelectField wrapper. Its only internal consumer (Studio settings) was migrated to SettingsRow + Select primitives. For form fields use SelectFieldBlock; for settings rows use SettingsRow.

**Before**

```tsx
<SelectField name="theme" label="Theme mode" value={theme} onValueChange={setTheme} options={THEME_OPTIONS} />
```

**After**

```tsx
<SettingsRow label="Theme mode" htmlFor="theme">
  <Select value={theme} onValueChange={setTheme}>
    <SelectTrigger id="theme" className="w-full sm:w-48">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>{/* items */}</SelectContent>
  </Select>
</SettingsRow>
```
