---
'@mastra/playground-ui': patch
---

Removed three rarely-used components from the root barrel export. `SettingsRow`, `PrevNextNav`, and `MetricsKpiCard` must now be imported from their per-component entrypoints (added in v33.1):

```ts
// before
import { SettingsRow, PrevNextNav, MetricsKpiCard } from '@mastra/playground-ui';

// after
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
import { PrevNextNav } from '@mastra/playground-ui/components/PrevNextNav';
import { MetricsKpiCard } from '@mastra/playground-ui/components/MetricsKpiCard';
```

This is the first step of gradually slimming down the root barrel so apps only load the components they use. All other root exports are unchanged.
