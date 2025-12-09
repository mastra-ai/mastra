# Using Mastra Processors with AI SDK

This example demonstrates how to use `withMastra` to wrap AI SDK models with Mastra processors and memory.

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env` and add your OpenAI API key:
   ```bash
   cp .env.example .env
   ```

## Running the Examples

### Basic Example (generateText with processors)

```bash
pnpm start
```

This example shows:

- Creating custom processors (logging, prefix)
- Using `withMastra` to wrap a model
- Running processors with `generateText`

### Streaming Example

```bash
pnpm start:stream
```

### Tripwire/Abort Example

```bash
pnpm start:tripwire
```

### Memory Example

```bash
pnpm start:memory
```

## How It Works

The `withMastra` function wraps an AI SDK model with Mastra processors and memory:

```typescript
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { withMastra } from '@mastra/ai-sdk';

// Create your processors
const myProcessor = {
  id: 'my-processor',
  async processInput({ messages }) {
    // Transform input messages
    return messages;
  },
  async processOutputResult({ messages }) {
    // Transform output messages
    return messages;
  },
};

// Wrap the model with processors
const model = withMastra(openai('gpt-4o'), {
  inputProcessors: [myProcessor],
  outputProcessors: [myProcessor],
});

// Use with generateText or streamText
const { text } = await generateText({
  model,
  prompt: 'Hello!',
});
```

## Processor Lifecycle

1. **`processInput`** - Runs before the LLM call, transforms input messages
2. **`processOutputStream`** - Runs on each streaming chunk (streaming only)
3. **`processOutputResult`** - Runs after the LLM call, transforms output messages

## Tripwire / Abort

Processors can abort processing by calling `abort(reason)`:

```typescript
const guardProcessor = {
  id: 'guard',
  async processInput({ messages, abort }) {
    for (const msg of messages) {
      if (containsBadContent(msg)) {
        abort('Content blocked by guard');
      }
    }
    return messages;
  },
};
```

When a processor aborts:

- The model is NOT called
- A blocked response is returned with the abort reason
