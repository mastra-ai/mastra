---
'@mastra/core': minor
---

Added `RequestContext.all` to access the entire `RequestContext` object values.

```typescript
const { userId, featureFlags } = requestContext.all;
```

Added `requestContextSchema` support to tools, agents, workflows, and steps. Define a Zod schema to validate and type requestContext values at runtime.

**Tool example:**

```typescript
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const myTool = createTool({
  id: 'my-tool',
  inputSchema: z.object({ query: z.string() }),
  requestContextSchema: z.object({
    userId: z.string(),
    apiKey: z.string(),
  }),
  execute: async ({ context }) => {
    // context.requestContext is typed as { userId: string, apiKey: string }
    const userId = context.requestContext?.get('userId');
    return { result: 'success' };
  },
});
```

**Agent example:**

```typescript
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'You are a helpful assistant',
  model: openai('gpt-4o'),
  requestContextSchema: z.object({
    userId: z.string(),
    featureFlags: z.object({
      debugMode: z.boolean().optional()
      enableSearch: z.boolean().optional()
    }).optional()
  }),
  instructions: ({ requestContext }) => {
    // Access validated context values with type safety
    const { userId } = requestContext.all;

    const baseInstructions = `You are a helpful assistant. The current user ID is: ${userId}.`;

    if (featureFlags?.debugMode) {
      return `${baseInstructions} Debug mode is enabled - provide verbose responses.`;
    }

    return baseInstructions;
  },
  tools: ({ requestContext }) => {
    const tools = {
      weatherInfo,
    };

    // Conditionally add tools based on validated feature flags
    const { featureFlags } = requestContext.all;
    if (featureFlags?.enableSearch) {
      tools['web_search_preview'] = openai.tools.webSearchPreview();
    }

    return tools;
  },
});
```

**Workflow example:**

```typescript
import { createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const workflow = createWorkflow({
  id: 'my-workflow',
  inputSchema: z.object({ data: z.string() }),
  requestContextSchema: z.object({
    tenantId: z.string(),
  }),
});

const step = createStep({
  id: 'my-step',
  description: 'My step description',
  inputSchema: z.object({ data: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  requestContextSchema: z.object({
    userId: z.string(),
  }),
  execute: async ({ inputData, requestContext }) => {
    const userId = requestContext?.get('userId');
    return {
      result: 'some result here',
    };
  },
});

workflow.then(step).commit()
```

When requestContextSchema is defined, validation runs automatically and throws an error if required context values are missing or invalid.
