# Using Mastra Processors with AI SDK

This example demonstrates how to use Mastra's processor middleware with the AI SDK's `generateText`, `streamText`, and `wrapLanguageModel` functions.

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
- Using `createProcessorMiddleware` to wrap a model
- Running processors with `generateText`

## How It Works

The `createProcessorMiddleware` function creates AI SDK middleware that runs Mastra processors:

```typescript
import { wrapLanguageModel, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createProcessorMiddleware } from '@mastra/core/processors';

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

// Wrap the model with processor middleware
const model = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: createProcessorMiddleware({
    inputProcessors: [myProcessor],
    outputProcessors: [myProcessor],
  }),
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
