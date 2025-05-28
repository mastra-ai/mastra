# Configuring Semantic Recall

Semantic recall is enabled by default when you create a Memory instance. However, you can customize its behavior with the following parameters:

1. **topK**: How many semantically similar messages to retrieve
2. **messageRange**: How much surrounding context to include with each match

Let's update our agent with custom semantic recall settings:

```typescript
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";

// Create a memory instance with semantic recall configuration
const memory = new Memory({
  options: {
    lastMessages: 20, // Include the last 20 messages in the context
    semanticRecall: {
      topK: 3, // Retrieve 3 most similar messages
      messageRange: {
        before: 2, // Include 2 messages before each match
        after: 1, // Include 1 message after each match
      },
    },
  },
});

// Create an agent with the configured memory
export const memoryAgent = new Agent({
  name: "MemoryAgent",
  instructions: `
    You are a helpful assistant with advanced memory capabilities.
    You can remember previous conversations and user preferences.
    When a user shares information about themselves, acknowledge it and remember it for future reference.
    If asked about something mentioned earlier in the conversation, recall it accurately.
    You can also recall relevant information from older conversations when appropriate.
  `,
  model: openai("gpt-4o"),
  memory: memory,
});
```

The `topK` parameter controls how many semantically similar messages are retrieved. A higher value will retrieve more messages, which can be helpful for complex topics but may also include less relevant information.

The `messageRange` parameter controls how much context is included with each match. This is important because the matching message alone might not provide enough context to understand the conversation. Including messages before and after the match helps the agent understand the context of the matched message.
