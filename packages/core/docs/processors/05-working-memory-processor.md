> Documentation for the WorkingMemory processor in Mastra, which injects persistent user/context data as system instructions.

# WorkingMemory

The `WorkingMemory` is an **input processor** that injects working memory data as a system message. It retrieves persistent information from storage and formats it as instructions for the LLM, enabling the agent to maintain context about users across conversations.

## Usage example

```typescript
import { WorkingMemory } from '@mastra/core/processors';

const processor = new WorkingMemory({
  storage: memoryStorage,
  scope: 'resource',
  template: {
    format: 'markdown',
    content: `# User Profile
- **Name**:
- **Preferences**:
- **Goals**:
`,
  },
});
```

## Constructor parameters

### Options

### WorkingMemoryTemplate

## Returns

## Extended usage example

```typescript title="src/mastra/agents/personalized-agent.ts"
import { Agent } from '@mastra/core/agent';
import { WorkingMemory, MessageHistory } from '@mastra/core/processors';
import { PostgresStorage } from '@mastra/pg';

const storage = new PostgresStorage({
  connectionString: process.env.DATABASE_URL,
});

export const agent = new Agent({
  name: 'personalized-agent',
  instructions: 'You are a helpful assistant that remembers user preferences',
  model: 'openai:gpt-4o',
  inputProcessors: [
    new WorkingMemory({
      storage,
      scope: 'resource',
      template: {
        format: 'markdown',
        content: `# User Information
- **Name**:
- **Location**:
- **Preferences**:
- **Communication Style**:
- **Current Projects**:
`,
      },
    }),
    new MessageHistory({ storage, lastMessages: 50 }),
  ],
  outputProcessors: [new MessageHistory({ storage })],
});
```

## JSON format example

```typescript
import { WorkingMemory } from '@mastra/core/processors';

const processor = new WorkingMemory({
  storage: memoryStorage,
  scope: 'resource',
  template: {
    format: 'json',
    content: JSON.stringify({
      user: {
        name: { type: 'string' },
        preferences: { type: 'object' },
        goals: { type: 'array' },
      },
    }),
  },
});
```

## Behavior

### Input processing

1. Retrieves `threadId` and `resourceId` from the request context
2. Based on scope, fetches working memory from either:
   - Thread metadata (`scope: 'thread'`)
   - Resource record (`scope: 'resource'`)
3. Resolves the template (from provider, options, or default)
4. Generates system instructions that include:
   - Guidelines for the LLM on storing and updating information
   - The template structure
   - Current working memory data
5. Adds the instruction as a system message with `source: 'memory'` tag

### Working memory updates

Working memory updates happen through the `updateWorkingMemory` tool provided by the Memory class, not through this processor. The processor only handles injecting the current working memory state into conversations.

### Default template

If no template is provided, the processor uses a default markdown template with fields for:

- First Name, Last Name
- Location, Occupation
- Interests, Goals
- Events, Facts, Projects

## Related

- [Guardrails](/docs/v1/agents/guardrails)
