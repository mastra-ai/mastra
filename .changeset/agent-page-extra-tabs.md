---
'@mastra/playground-ui': minor
---

`AgentPageTabs` (and `AgentPage`'s `tabs`) accept `extraTabs`, so hosts can add their own agent views after Chat, Traces and Editor. `activeTab` takes an extra tab's `id`.

```tsx
import { AgentPageTabs } from '@mastra/playground-ui/domains/agents/chat/agent-page-tabs';
import { IconCalendar1 } from '@mastra/playground-ui/icons/central/IconCalendar1';

<AgentPageTabs
  activeTab="schedules"
  chatHref={`/agents/${agentId}/chat`}
  extraTabs={[
    { id: 'schedules', href: `/agents/${agentId}/schedules`, label: 'Schedules', icon: <IconCalendar1 /> },
  ]}
/>;
```