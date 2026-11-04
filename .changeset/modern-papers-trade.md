---
'@mastra/playground-ui': minor
---

Added distinct chat icons for Knowledge, files, terminal, browser, delegation, workflows, schedules, notifications, source control and skills. Running calls animate to show their action. Icons are clearer at small sizes.

`presentTool` reads a call's arguments, so the same tool can show a different icon per operation. For example, deleting a Knowledge page no longer looks like editing one:

```tsx
import { AgentIndicator } from '@mastra/playground-ui/components/AgentIndicator';
import { presentTool } from '@mastra/playground-ui/components/ai/tool-call';

const { pose, icon: Icon, label } = presentTool('knowledge_page', { op: 'delete', page: 'Refund policy' });

<AgentIndicator state={pose} />; // live, while the call runs
<Icon aria-hidden />; // still, on the settled row; label is "Delete page"
```
