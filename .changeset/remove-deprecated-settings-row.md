---
'@mastra/playground-ui': minor
---

Removed the deprecated `SettingsRow` export at `@mastra/playground-ui/components/SettingsRow`. Import `SettingsRow` from `@mastra/playground-ui/new/settings` and place rows inside a `SettingsContainer`, which owns the row padding and dividers.

**Before**

```tsx
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';

<div className="divide-y divide-border">
  <SettingsRow label="Account" className="py-3">
    {accountLabel}
  </SettingsRow>
</div>;
```

**After**

```tsx
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';

<SettingsContainer>
  <SettingsRow label="Account">{accountLabel}</SettingsRow>
</SettingsContainer>;
```
