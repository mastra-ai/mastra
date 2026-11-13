---
'@mastra/playground-ui': minor
---

Added `SettingsControlGroup` for settings rows with several controls (for example a period select and an amount). It takes the shared field width, so the controls end on the same edge as the rest of the column, without a hand-set width. The SettingsRow docs now also cover boolean settings: a switch alone, disabled when the viewer can't change it.

```tsx
import { SettingsControlGroup, SettingsRow } from '@mastra/playground-ui/new/settings';

<SettingsRow label="Spend limit">
  <SettingsControlGroup>
    <Select value={period} onValueChange={setPeriod}>
      <SelectTrigger aria-label="Period" className="w-32 shrink-0">
        <SelectValue />
      </SelectTrigger>
      {/* … */}
    </Select>
    <Input aria-label="Limit" className="flex-1" value={amount} onChange={onAmountChange} />
  </SettingsControlGroup>
</SettingsRow>;
```
