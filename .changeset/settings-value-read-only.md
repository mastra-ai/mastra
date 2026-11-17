---
'@mastra/playground-ui': minor
---

Added `SettingsValue` (`@mastra/playground-ui/new/settings`) for settings values people read but don't change or copy, like a name, an email or a sign-in method. It shows the value as plain muted text that truncates, with the whole value on hover; `mono` sets it in monospace for values like versions.

```tsx
import { SettingsItem, SettingsValue } from '@mastra/playground-ui/new/settings';

<SettingsItem title="Email" description="From your sign-in provider.">
  <SettingsValue>{user.email}</SettingsValue>
</SettingsItem>;
```

A row that only shows a value is a `SettingsItem`: it holds a `CopyField` for a value the person will paste elsewhere, and a `SettingsValue` for one they only read.
