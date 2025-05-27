# Adding Memory to Your Agent

Now, let's update our agent to include memory. Open your `agents/index.ts` file and make the following changes:

1. Import the Memory class:

```typescript
import { Agent } from "@mastra/core";
import { openai } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import { getTransactionsTool } from "../tools";
```

2. Add memory to your agent:

```typescript
export const financialAgent = new Agent({
  name: "Financial Assistant Agent",
  instructions: `ROLE DEFINITION
  // ... existing instructions ...
  `,
  model: openai("gpt-4o"),
  tools: { getTransactionsTool },
  memory: new Memory(), // Add memory here
});
```

By adding the `memory` property to your agent configuration, you're enabling it to remember previous conversations. The `Memory` class from the `@mastra/memory` package provides a simple way to add memory capabilities to your agent.
