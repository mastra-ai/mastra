---
'@mastra/server': minor
---

Added authenticated HTTP APIs for creating and inspecting shared-history conversation branches.

Hardened existing memory, agent, Conversations, Responses, and A2A routes so branch participants use effective request-context identities, complete ancestry authorization, and non-revealing pending or inaccessible branch errors.

    const response = await fetch('/api/memory/threads/conversation-1/branch?agentId=my-agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ branchPointMessageId: 'message-3' }),
    });
    const { thread, branch } = await response.json();
