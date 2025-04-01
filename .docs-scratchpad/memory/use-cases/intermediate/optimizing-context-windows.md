# Optimizing Context Windows with Memory Processors

**Use Case**: Filtering and transforming recalled messages to prevent context overflow and optimize relevance.

**Why Users Need This**:
- Prevent token overflows with large models
- Remove unnecessary content from history
- Focus context on most relevant information
- Control costs by reducing token usage

**Implementation Example**:
```typescript
import { TokenLimiter, ToolCallFilter } from "@mastra/memory/processors";

const agent = new Agent({
  memory: new Memory({
    processors: [
      // Remove previous image generation tool calls to save tokens
      new ToolCallFilter({ exclude: ["imageGenTool"] }),
      
      // Limit total token count to fit in context window
      new TokenLimiter(127000), // For gpt-4o context size
    ],
    options: {
      lastMessages: 50, // We can use a larger window since we're filtering
    }
  }),
});
``` 