---
'@mastra/memory': minor
---

Added shared-history conversation branches with reachable-only message recall and branch-owned Observational Memory.

    const { thread: branch } = await memory.branchThread({
      threadId: 'conversation-1',
      branchPointMessageId: 'message-3',
      title: 'Alternative answer',
    });
