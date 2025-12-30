> Documentation for the TokenLimiterProcessor in Mastra, which limits the number of tokens in messages.

# TokenLimiterProcessor

The `TokenLimiterProcessor` limits the number of tokens in messages. It can be used as both an input and output processor:

- **Input processor**: Filters historical messages to fit within the context window, prioritizing recent messages
- **Output processor**: Limits generated response tokens via streaming or non-streaming with configurable strategies for handling exceeded limits

## Usage example

```typescript
import { TokenLimiterProcessor } from '@mastra/core/processors';

const processor = new TokenLimiterProcessor({
  limit: 1000,
  strategy: 'truncate',
  countMode: 'cumulative',
});
```

## Constructor parameters

### Options

## Returns

## Extended usage example

### As an input processor (limit context window)

Use `inputProcessors` to limit historical messages sent to the model, which helps stay within context window limits:

```typescript title="src/mastra/agents/context-limited-agent.ts"
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { TokenLimiterProcessor } from '@mastra/core/processors';

export const agent = new Agent({
  name: 'context-limited-agent',
  instructions: 'You are a helpful assistant',
  model: 'openai/gpt-4o',
  memory: new Memory({
    /* ... */
  }),
  inputProcessors: [
    new TokenLimiterProcessor({ limit: 4000 }), // Limits historical messages to ~4000 tokens
  ],
});
```

### As an output processor (limit response length)

Use `outputProcessors` to limit the length of generated responses:

```typescript title="src/mastra/agents/response-limited-agent.ts"
import { Agent } from '@mastra/core/agent';
import { TokenLimiterProcessor } from '@mastra/core/processors';

export const agent = new Agent({
  name: 'response-limited-agent',
  instructions: 'You are a helpful assistant',
  model: 'openai/gpt-4o',
  outputProcessors: [
    new TokenLimiterProcessor({
      limit: 1000,
      strategy: 'truncate',
      countMode: 'cumulative',
    }),
  ],
});
```

## Related

- [Guardrails](/docs/v1/agents/guardrails)
