# Configuring Working Memory

Let's update our agent with working memory capabilities:

```typescript
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";

// Create a memory instance with working memory configuration
const memory = new Memory({
  options: {
    lastMessages: 20,
    semanticRecall: {
      topK: 3,
      messageRange: {
        before: 2,
        after: 1,
      },
    },
    workingMemory: {
      enabled: true,
      use: "tool-call", // Recommended setting
    },
  },
});

// Create an agent with the configured memory
export const memoryAgent = new Agent({
  name: "MemoryAgent",
  instructions: `
    You are a helpful assistant with advanced memory capabilities.
    You can remember previous conversations and user preferences.
    
    IMPORTANT: You have access to working memory to store persistent information about the user.
    When you learn something important about the user, update your working memory.
    This includes:
    - Their name
    - Their location
    - Their preferences
    - Their interests
    - Any other relevant information that would help personalize the conversation
    
    Always refer to your working memory before asking for information the user has already provided.
    Use the information in your working memory to provide personalized responses.
  `,
  model: openai("gpt-4o"),
  memory: memory,
});
```

The `workingMemory` configuration has several important options:

- `enabled`: Whether working memory is enabled
- `use`: How the agent interacts with working memory (recommended setting is "tool-call")

The `use` option can be set to:

- `"tool-call"`: The agent updates working memory via tool calls (recommended)
- `"direct"`: The agent directly edits the working memory text
- `"read-only"`: The agent can read but not update working memory

The instructions for the agent are also important. They guide the agent on what information to store in working memory and how to use that information when responding to the user.
