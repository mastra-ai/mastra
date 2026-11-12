---
'@mastra/playground-ui': minor
---

Added `AgentSession`, Studio's agent chat with its Config panel, as a published export so other apps can render the same agent page against their own Mastra server.

```tsx
import { MastraReactProvider } from '@mastra/react';
import { AgentSession } from '@mastra/playground-ui/domains/agents/session';

<MastraReactProvider baseUrl={serverUrl}>
  <AgentSession agentId="weatherAgent" threadId={threadId} isNewThread />
</MastraReactProvider>;
```

Host-only features plug in through slots: `landingSlot`, `transcriptTopSlot`, `composerTopSlot`, `composerActionsSlot`, `configChannelsSlot` and `configSystemPromptNoticeSlot`.
