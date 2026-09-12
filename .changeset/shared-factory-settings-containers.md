---
'@mastra/playground-ui': minor
---

Added shared `SettingsCard` and `SettingsSubsection` components so Studio and Factory use the same settings containers and headings.

```tsx
import { SettingsCard } from '@mastra/playground-ui/components/SettingsCard';
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
import { SettingsSubsection } from '@mastra/playground-ui/components/SettingsSubsection';
import { ThemeToggle } from '@mastra/playground-ui/components/ThemeToggle';

<SettingsSubsection title="General" description="Stored in this browser.">
  <SettingsCard>
    <SettingsRow variant="factory" label="Theme">
      <ThemeToggle />
    </SettingsRow>
  </SettingsCard>
</SettingsSubsection>;
```
