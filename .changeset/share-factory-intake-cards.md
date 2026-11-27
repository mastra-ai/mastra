---
'@mastra/playground-ui': minor
---

Added Factory's intake settings to `@mastra/playground-ui/domains/factory`: source cards for Jira, GitLab, incident.io and Vanta, the source picker and sync control, and Connect and manage buttons for platform integrations, Linear included. Apps other than Factory can now render the same intake settings.

The build trigger settings ship separately as `BuildTriggersRows` from `@mastra/playground-ui/components/EnvironmentBuild`:

```tsx
import { BuildTriggersRows } from '@mastra/playground-ui/components/EnvironmentBuild';

<BuildTriggersRows triggers={environment.buildTriggers} disabled={saving} onSave={save} />;
```
