---
'@mastra/core': minor
---

Added ToolSearchProcessor for dynamic tool discovery.

Agents can now discover and load tools on demand instead of having all tools available upfront. This reduces context token usage by ~94% when working with large tool libraries.

**New API:**

```typescript
import { ToolSearchProcessor } from '@mastra/core/processors';
import { Agent } from '@mastra/core';

// Create a processor with searchable tools
const toolSearch = new ToolSearchProcessor({
  tools: {
    createIssue: githubTools.createIssue,
    sendEmail: emailTools.send,
    // ... hundreds of tools
  },
  search: {
    topK: 5,        // Return top 5 results (default: 5)
    minScore: 0.1,  // Filter results below this score (default: 0)
  },
});

// Attach processor to agent
const agent = new Agent({
  name: 'my-agent',
  inputProcessors: [toolSearch],
  tools: { /* always-available tools */ },
});
```

**How it works:**

The processor automatically provides two meta-tools to the agent:
- `search_tools` - Search for available tools by keyword relevance
- `load_tool` - Load a specific tool into the conversation

The agent discovers what it needs via search and loads tools on demand. Loaded tools are available immediately and persist within the conversation thread.

**Why:**

When agents have access to 100+ tools (from MCP servers or integrations), including all tool definitions in the context can consume significant tokens (~1,500 tokens per tool). This pattern reduces context usage by giving agents only the tools they need, when they need them.
