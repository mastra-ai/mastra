# OpenRouter Provider for Vercel AI SDK

The [OpenRouter](https://openrouter.ai/) provider for the [Vercel AI SDK](https://sdk.vercel.ai/docs) gives access to over 300 large language model on the OpenRouter chat and completion APIs.

## Setup

```bash
# For pnpm
pnpm add @openrouter/ai-sdk-provider

# For npm
npm install @openrouter/ai-sdk-provider

# For yarn
yarn add @openrouter/ai-sdk-provider
```

## Provider Instance

You can import the default provider instance `openrouter` from `@openrouter/ai-sdk-provider`:

```ts
import { openrouter } from '@openrouter/ai-sdk-provider';
```

## Example

```ts
import { openrouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

const { text } = await generateText({
  model: openrouter('openai/gpt-4o'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});
```

## Supported models

This list is not a definitive list of models supported by OpenRouter, as it constantly changes as we add new models (and deprecate old ones) to our system.  
You can find the latest list of models supported by OpenRouter [here](https://openrouter.ai/models).

You can find the latest list of tool-supported models supported by OpenRouter [here](https://openrouter.ai/models?order=newest&supported_parameters=tools). (Note: This list may contain models that are not compatible with the AI SDK.)

## Passing Extra Body to OpenRouter

There are 3 ways to pass extra body to OpenRouter:

1. Via the `providerOptions.openrouter` property:

   ```typescript
   import { createOpenRouter } from '@openrouter/ai-sdk-provider';
   import { streamText } from 'ai';

   const openrouter = createOpenRouter({ apiKey: 'your-api-key' });
   const model = openrouter('anthropic/claude-3.7-sonnet:thinking');
   await streamText({
     model,
     messages: [{ role: 'user', content: 'Hello' }],
     providerOptions: {
       openrouter: {
         reasoning: {
           max_tokens: 10,
         },
       },
     },
   });
   ```

2. Via the `extraBody` property in the model settings:

   ```typescript
   import { createOpenRouter } from '@openrouter/ai-sdk-provider';
   import { streamText } from 'ai';

   const openrouter = createOpenRouter({ apiKey: 'your-api-key' });
   const model = openrouter('anthropic/claude-3.7-sonnet:thinking', {
     extraBody: {
       reasoning: {
         max_tokens: 10,
       },
     },
   });
   await streamText({
     model,
     messages: [{ role: 'user', content: 'Hello' }],
   });
   ```

3. Via the `extraBody` property in the model factory.

   ```typescript
   import { createOpenRouter } from '@openrouter/ai-sdk-provider';
   import { streamText } from 'ai';

   const openrouter = createOpenRouter({
     apiKey: 'your-api-key',
     extraBody: {
       reasoning: {
         max_tokens: 10,
       },
     },
   });
   const model = openrouter('anthropic/claude-3.7-sonnet:thinking');
   await streamText({
     model,
     messages: [{ role: 'user', content: 'Hello' }],
   });
   ```

## Anthropic Prompt Caching

You can include Anthropic-specific options directly in your messages when using functions like `streamText`. The OpenRouter provider will automatically convert these messages to the correct format internally.

### Basic Usage

```typescript
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText } from 'ai';

const openrouter = createOpenRouter({ apiKey: 'your-api-key' });
const model = openrouter('anthropic/<supported-caching-model>');

await streamText({
  model,
  messages: [
    {
      role: 'system',
      content:
        'You are a podcast summary assistant. You are detail oriented and critical about the content.',
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Given the text body below:',
        },
        {
          type: 'text',
          text: `<LARGE BODY OF TEXT>`,
          providerOptions: {
            openrouter: {
              cacheControl: { type: 'ephemeral' },
            },
          },
        },
        {
          type: 'text',
          text: 'Who're the speakers?',
        },
      ],
    },
  ],
});
```
