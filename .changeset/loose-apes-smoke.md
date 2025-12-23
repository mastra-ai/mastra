---
'@mastra/core': minor
---

Add support for AI SDK v6 ToolLoopAgent in Mastra

You can now pass an AI SDK v6 `ToolLoopAgent` directly to Mastra's agents configuration. The agent will be automatically converted to a Mastra Agent while preserving all ToolLoopAgent lifecycle hooks:

- `prepareCall` - Called once at the start of generate/stream
- `prepareStep` - Called before each step in the agentic loop
- `stopWhen` - Custom stop conditions for the loop

Example:

```typescript
import { ToolLoopAgent } from 'ai';
import { Mastra } from '@mastra/core/mastra';

const toolLoopAgent = new ToolLoopAgent({
  model: openai('gpt-4o'),
  instructions: 'You are a helpful assistant.',
  tools: { weather: weatherTool },
  prepareStep: async ({ stepNumber }) => {
    if (stepNumber === 0) {
      return { toolChoice: 'required' };
    }
    return {};
  },
});

const mastra = new Mastra({
  agents: { toolLoopAgent },
});

// Use like any other Mastra agent
const agent = mastra.getAgent('toolLoopAgent');
const result = await agent.generate('What is the weather?');
```
