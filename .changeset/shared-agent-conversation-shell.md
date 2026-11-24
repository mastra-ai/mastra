---
'@mastra/playground-ui': patch
---

Share the Studio agent conversation shell and thread navigation with managed-agent hosts. `AgentConversationLayout` accepts host-provided content slots and panel registration; `AgentConversationSidebar` accepts host-owned navigation and collapse actions; `AgentConversationThreads` provides a controlled thread list without owning routing, data fetching, or mutations.

```tsx
import { AgentConversationLayout } from '@mastra/playground-ui/domains/agents/components/agent-conversation-layout';
import { AgentConversationThreads } from '@mastra/playground-ui/domains/agents/components/agent-conversation-threads';

<AgentConversationLayout
  layoutId="managed-agent-layout"
  leftSlot={
    <AgentConversationThreads
      threads={threads}
      selectedThreadId={threadId}
      onSelectThread={selectThread}
      onNewThread={createThread}
    />
  }
>
  {conversation}
</AgentConversationLayout>;
```
