---
'@mastra/client-js': minor
---

Added typed methods for creating and navigating shared-history conversation branches.

    const thread = client.getMemoryThread({ threadId: 'conversation-1', agentId: 'my-agent' });
    const { thread: branch } = await thread.branch({ branchPointMessageId: 'message-3' });
    const history = await client.getMemoryThread({ threadId: branch.id, agentId: 'my-agent' }).getBranchHistory();
