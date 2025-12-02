![hero illustration](./assets/hero.gif)

# AI SDK

The [AI SDK](https://ai-sdk.dev/docs) is a TypeScript toolkit designed to help you build AI-powered applications and agents using popular frameworks like Next.js, React, Svelte, Vue and runtimes like Node.js.

To learn more about how to use the AI SDK, check out our [API Reference](https://ai-sdk.dev/docs/reference) and [Documentation](https://ai-sdk.dev/docs).

## Installation

You will need Node.js 18+ and npm (or another package manager) installed on your local development machine.

```shell
npm install ai
```

## Unified Provider Architecture

The AI SDK provides a [unified API](https://ai-sdk.dev/docs/foundations/providers-and-models) to interact with model providers like [OpenAI](https://ai-sdk.dev/providers/ai-sdk-providers/openai), [Anthropic](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic), [Google](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai), and [more](https://ai-sdk.dev/providers/ai-sdk-providers).

```shell
npm install @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google
```

Alternatively you can use the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway).

## Usage

### Generating Text

```ts
import { generateText } from 'ai';

const { text } = await generateText({
  model: 'openai/gpt-5', // use Vercel AI Gateway
  prompt: 'What is an agent?',
});
```

```ts
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const { text } = await generateText({
  model: openai('gpt-5'), // use OpenAI Responses API directly
  prompt: 'What is an agent?',
});
```

### Generating Structured Data

```ts
import { generateObject } from 'ai';
import { z } from 'zod';

const { object } = await generateObject({
  model: 'openai/gpt-5',
  schema: z.object({
    recipe: z.object({
      name: z.string(),
      ingredients: z.array(z.object({ name: z.string(), amount: z.string() })),
      steps: z.array(z.string()),
    }),
  }),
  prompt: 'Generate a lasagna recipe.',
});
```

### UI Integration

The [AI SDK UI](https://ai-sdk.dev/docs/ai-sdk-ui/overview) module provides a set of hooks that help you build chatbots and generative user interfaces. These hooks are framework agnostic, so they can be used in Next.js, React, Svelte, and Vue.

You need to install the package for your framework, e.g.:

```shell
npm install @ai-sdk/react
```

###### @/app/page.tsx (Next.js App Router)

```tsx
'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';

export default function Page() {
  const { messages, status, sendMessage } = useChat();
  const [input, setInput] = useState('');
  const handleSubmit = e => {
    e.preventDefault();
    sendMessage({ text: input });
    setInput('');
  };

  return (
    <div>
      {messages.map(message => (
        <div key={message.id}>
          <strong>{`${message.role}: `}</strong>
          {message.parts.map((part, index) => {
            switch (part.type) {
              case 'text':
                return <span key={index}>{part.text}</span>;

              // other cases can handle images, tool calls, etc
            }
          })}
        </div>
      ))}

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          placeholder="Send a message..."
          onChange={e => setInput(e.target.value)}
          disabled={status !== 'ready'}
        />
      </form>
    </div>
  );
}
```

###### @/app/api/chat/route.ts (Next.js App Router)

```ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    system: 'You are a helpful assistant.',
    messages,
  });

  return result.toUIMessageStreamResponse();
}
```

## Templates

We've built [templates](https://vercel.com/templates?type=ai) that include AI SDK integrations for different use cases, providers, and frameworks. You can use these templates to get started with your AI-powered application.

## Community

The AI SDK community can be found on [the Vercel Community](https://community.vercel.com/c/ai-sdk/62) where you can ask questions, voice ideas, and share your projects with other people.

## Contributing

Contributions to the AI SDK are welcome and highly appreciated. However, before you jump right into it, we would like you to review our [Contribution Guidelines](https://github.com/vercel/ai/blob/main/CONTRIBUTING.md) to make sure you have smooth experience contributing to AI SDK.

## Authors

This library is created by [Vercel](https://vercel.com) and [Next.js](https://nextjs.org) team members, with contributions from the [Open Source Community](https://github.com/vercel/ai/graphs/contributors).
