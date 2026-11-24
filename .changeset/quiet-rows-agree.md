---
'@mastra/playground-ui': minor
---

Fixed field widths in `SettingsRow`. Every field you type in (`Input`, `InputGroup`, `InputNumber` and `Combobox`) now takes one width from the row, also when it sits inside a wrapper such as a `Field` or a `form`. Selects still hug their value up to that width. A `Combobox` no longer collapses to its chevron in a row, so it needs no width class.

Added `SettingsControl`, which gives fields outside a `SettingsRow` the same widths.

```tsx
import { SettingsControl, SettingsRow } from '@mastra/playground-ui/new/settings';

<SettingsRow label="Model">
  <Combobox options={models} value={model} onValueChange={setModel} />
</SettingsRow>

<SettingsControl>
  <Input aria-label="Session" />
</SettingsControl>
```
