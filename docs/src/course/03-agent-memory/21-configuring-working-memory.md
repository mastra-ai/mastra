# Configuring Working Memory

Let's update our agent with working memory capabilities:

```typescript
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";

// Create a memory instance with working memory configuration
const memory = new Memory({
  // ... other memory options
  options: {
    // ... other options
    workingMemory: {
      enabled: true,
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
- `template`: A template for the working memory content

The instructions for the agent are also important. They guide the agent on what information to store in working memory and how to use that information when responding to the user.
