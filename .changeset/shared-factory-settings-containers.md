---
'@mastra/playground-ui': minor
---

Added the named settings components at `@mastra/playground-ui/new/settings`: `SettingsGroup`, `SettingsHeader`, `SettingsTitle`, `SettingsDescription`, `SettingsContainer`, and `SettingsRow`, alongside the existing `SettingsLayout`.

The components use Factory's settings presentation. Import `SettingsRow` from the new entry point without `variant="factory"`. The old `components/SettingsRow` and settings-specific `Section` row APIs remain compatible through shared implementations and are deprecated for new settings screens.

```tsx
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';

<SettingsContainer>
  <SettingsRow label="API prefix" htmlFor="api-prefix">
    <input id="api-prefix" defaultValue="/api" />
  </SettingsRow>
</SettingsContainer>;
```
