> Documentation for the Step class in Mastra, which defines individual units of work within a workflow.

# Step Class

The Step class defines individual units of work within a workflow, encapsulating execution logic, data validation, and input/output handling.
It can take either a tool or an agent as a parameter to automatically create a step from them.

## Usage example

```typescript title="src/mastra/workflows/test-workflow.ts"
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const step1 = createStep({
  id: 'step-1',
  description: 'passes value from input to output',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { value } = inputData;
    return {
      value,
    };
  },
});
```

## Creating steps from agents

You can create a step directly from an agent. The step will use the agent's name as its ID.

### Basic agent step

```typescript title="src/mastra/workflows/test-workflow.ts"
import { testAgent } from '../agents/test-agent';

const agentStep = createStep(testAgent);
// inputSchema: { prompt: string }
// outputSchema: { text: string }
```

### Agent step with structured output

Pass `structuredOutput` to have the agent return typed structured data:

```typescript title="src/mastra/workflows/test-workflow.ts"
const articleSchema = z.object({
  title: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
});

const agentStep = createStep(testAgent, {
  structuredOutput: { schema: articleSchema },
});
// inputSchema: { prompt: string }
// outputSchema: { title: string, summary: string, tags: string[] }
```

### Agent step options

## Constructor Parameters

### ExecuteParams

## Related

- [Workflow state](/docs/v1/workflows/workflow-state)
- [Control flow](/docs/v1/workflows/control-flow)
- [Using agents and tools](/docs/v1/workflows/agents-and-tools)
