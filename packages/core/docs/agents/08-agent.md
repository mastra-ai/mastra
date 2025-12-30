> Documentation for the `Agent` class in Mastra, which provides the foundation for creating AI agents with various capabilities.

# Agent Class

The `Agent` class is the foundation for creating AI agents in Mastra. It provides methods for generating responses, streaming interactions, and handling voice capabilities.

## Usage examples

### Basic string instructions

```typescript title="src/mastra/agents/string-agent.ts"
import { Agent } from '@mastra/core/agent';

// String instructions
export const agent = new Agent({
  id: 'test-agent',
  name: 'Test Agent',
  instructions: 'You are a helpful assistant that provides concise answers.',
  model: 'openai/gpt-5.1',
});

// System message object
export const agent2 = new Agent({
  id: 'test-agent-2',
  name: 'Test Agent 2',
  instructions: {
    role: 'system',
    content: 'You are an expert programmer',
  },
  model: 'openai/gpt-5.1',
});

// Array of system messages
export const agent3 = new Agent({
  id: 'test-agent-3',
  name: 'Test Agent 3',
  instructions: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'system', content: 'You have expertise in TypeScript' },
  ],
  model: 'openai/gpt-5.1',
});
```

### Single CoreSystemMessage

Use CoreSystemMessage format to access additional properties like `providerOptions` for provider-specific configurations:

```typescript title="src/mastra/agents/core-message-agent.ts"
import { Agent } from '@mastra/core/agent';

export const agent = new Agent({
  id: 'core-message-agent',
  name: 'Core Message Agent',
  instructions: {
    role: 'system',
    content: 'You are a helpful assistant specialized in technical documentation.',
    providerOptions: {
      openai: {
        reasoningEffort: 'low',
      },
    },
  },
  model: 'openai/gpt-5.1',
});
```

### Multiple CoreSystemMessages

```typescript title="src/mastra/agents/multi-message-agent.ts"
import { Agent } from '@mastra/core/agent';

// This could be customizable based on the user
const preferredTone = {
  role: 'system',
  content: 'Always maintain a professional and empathetic tone.',
};

export const agent = new Agent({
  id: 'multi-message-agent',
  name: 'Multi Message Agent',
  instructions: [
    { role: 'system', content: 'You are a customer service representative.' },
    preferredTone,
    {
      role: 'system',
      content: 'Escalate complex issues to human agents when needed.',
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' } },
      },
    },
  ],
  model: 'anthropic/claude-sonnet-4-20250514',
});
```

## Constructor parameters

## Returns

## Related

- [Agents overview](/docs/v1/agents/overview)
