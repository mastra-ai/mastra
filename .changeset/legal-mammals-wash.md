---
'@mastra/playground-ui': patch
---

Removed five rarely-used components from the root barrel export. `SettingsRow`, `PrevNextNav`, `MetricsKpiCard`, `SideDialog`, and `ContextMenu` must now be imported from their per-component entrypoints (added in v33.1):

```ts
// before
import { SettingsRow, SideDialog, type SideDialogRootProps } from '@mastra/playground-ui';

// after
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
import { SideDialog, type SideDialogRootProps } from '@mastra/playground-ui/components/SideDialog';
```

This is the first step of gradually slimming down the root barrel so apps only load the components they use. All other root exports are unchanged.
