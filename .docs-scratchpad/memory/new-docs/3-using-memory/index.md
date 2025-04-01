# Using Memory in Mastra

Mastra's memory system offers several powerful features for maintaining context in your agents. This section covers the various ways you can utilize memory to enhance your agent's capabilities.

## Memory Features

- **[Last Messages](./3.1-last-messages.md)**: Include recent conversation history automatically
- **[Semantic Recall](./3.2-semantic-recall.md)**: Find and retrieve relevant past messages through vector search
- **[Working Memory](./3.3-working-memory.md)**: Store persistent information about users across conversations
- **[Frontend Integration](./3.4-frontend-integration.md)**: Integrate memory with Mastra client and UI frameworks
- **[Token Management](./3.5-token-management.md)**: Optimize token usage and context window management
- **[Memory in Workflows](./3.6-memory-workflows.md)**: Use memory within Mastra workflow steps

## Basic Memory Usage

By default, when you create a Memory instance and use it with an agent, the system will:

1. Automatically store all messages sent to or from the agent
2. Include recent messages (default: 40) in the context window
3. Perform semantic search to find relevant past messages
4. Manage token usage to fit within model constraints

Example of basic memory usage:

```typescript
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";

// Create a memory instance with default settings
const memory = new Memory();

// Create an agent with memory
const agent = new Agent({
  name: "CustomerSupport",
  instructions: "You are a helpful customer support agent.",
  model: openai("gpt-4o"),
  memory: memory,
});

// Memory is automatically saved and retrieved when using resourceId and threadId
await agent.stream("I'm having trouble with my account", {
  resourceId: "user_123",
  threadId: "support_thread_456",
});
```

## Memory Configuration

You can customize how memory behaves by configuring its options:

```typescript
const memory = new Memory({
  options: {
    // Include this many recent messages in the context
    lastMessages: 20,
    
    // Configure semantic search
    semanticRecall: {
      topK: 3,           // Number of similar messages to find
      messageRange: 2,   // Context around each match (before/after)
    },
    
    // Enable working memory
    workingMemory: {
      enabled: true,
    },
  },
});
```

## When to Use Different Memory Types

- **Last Messages**: Use for maintaining immediate conversation context
- **Semantic Recall**: Use when conversations are long or when specific information might be mentioned earlier
- **Working Memory**: Use for maintaining persistent user information like preferences, facts, or state

Explore each memory feature to learn how to effectively leverage Mastra's memory system in your agents. 