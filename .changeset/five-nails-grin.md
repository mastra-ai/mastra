---
'@mastra/playground-ui': minor
---

`SettingsRow` now gives every control the same column: the shared field width (13.75rem), on the right. Selects, comboboxes and inputs fill it, several controls in one row split it, and switches and buttons keep their own size. Every row's controls end on the same edge without the page sizing anything, so drop wrapper `div`s and width classes around row controls. A control that needs more room goes under its label with `controlPlacement="below"`.

```tsx
<SettingsRow label="Spend limit">
  <Select value={period} onValueChange={setPeriod}>
    <SelectTrigger aria-label="Period">
      <SelectValue />
    </SelectTrigger>
    {/* … */}
  </Select>
  <Input aria-label="Limit" value={amount} onChange={onAmountChange} />
</SettingsRow>
```
