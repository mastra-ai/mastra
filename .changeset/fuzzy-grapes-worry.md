---
'@mastra/server': minor
---

Added authenticated HTTP APIs for creating and inspecting shared-history conversation branches.

    const response = await fetch('/api/memory/threads/conversation-1/branch?agentId=my-agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ branchPointMessageId: 'message-3' }),
    });
    const { thread, branch } = await response.json();
