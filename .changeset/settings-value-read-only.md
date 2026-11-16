---
'@mastra/playground-ui': minor
---

Added `SettingsValue` (`@mastra/playground-ui/new/settings`) for settings values people read but don't change or copy, like a name, an email or a sign-in method. It shows the value as plain muted text that truncates, with the whole value on hover; `mono` sets it in monospace for values like versions.

```tsx
import { SettingsRow, SettingsValue } from '@mastra/playground-ui/new/settings';

<SettingsRow label="Email" description="From your sign-in provider.">
  <SettingsValue>{user.email}</SettingsValue>
</SettingsRow>;
```

Pick a row's value by what the person does with it: the control when they can change it, `SettingsRow viewOnly` for a setting they can't change, `CopyField` for a value they'll paste elsewhere, and `SettingsValue` for information to read.
