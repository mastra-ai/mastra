---
'@mastra/core': minor
---

Added dynamic tool search pattern for agents.

Agents can now discover and load tools on demand instead of having all tools available upfront. This reduces context token usage by ~94% when working with large tool libraries.

**New API:**

```typescript
import { createDynamicToolSet } from '@mastra/core/tools/dynamic';

// Create a searchable tool registry
const { searchTool, loadTool, getLoadedTools } = createDynamicToolSet({
  tools: {
    createIssue: githubTools.createIssue,
    sendEmail: emailTools.send,
    // ... hundreds of tools
  },
});

// Agent starts with just search and load capabilities
const agent = new Agent({
  name: 'my-agent',
  tools: async ({ requestContext }) => {
    const threadId = requestContext.get('mastra__threadId');
    const loadedTools = await getLoadedTools({ threadId });
    return {
      search_tools: searchTool,
      load_tool: loadTool,
      ...loadedTools, // Tools loaded during conversation
    };
  },
});
```

The agent can search for tools by keyword using BM25 ranking, load specific tools into the conversation, and use them on subsequent turns. Loaded tools persist per conversation thread.
