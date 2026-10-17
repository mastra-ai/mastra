---
'@mastra/playground-ui': minor
---

Added `AgentSession`, the Studio agent chat with its config panel, as a published export so other apps can render the same agent page.

```tsx
import { MastraReactProvider } from '@mastra/react';
import { AgentSession } from '@mastra/playground-ui/domains/agents/session';

<MastraReactProvider baseUrl={serverUrl}>
  <AgentSession agentId="weatherAgent" threadId={threadId} isNewThread />
</MastraReactProvider>;
```

The config panel is also available alone from `@mastra/playground-ui/domains/agents/config-panel` as `AgentOverviewPanel`. All data comes through `@mastra/react` hooks. Voice, browser preview, channels and the system prompt notice are optional slot props, so hosts render them only if they support them.
