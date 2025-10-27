---
title: 'With Vercel AI SDK'
description: 'Learn how Mastra leverages the Vercel AI SDK library and how you can leverage it further with Mastra'
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Using Vercel AI SDK

Mastra integrates with [Vercel's AI SDK](https://sdk.vercel.ai) to support model routing, React Hooks, and data streaming methods.

## Model Routing

When creating agents in Mastra, you can specify any AI SDK-supported model.

```typescript {6} filename="agents/weather-agent.ts" copy
import { Agent } from '@mastra/core/agent';

export const weatherAgent = new Agent({
  name: 'Weather Agent',
  instructions: 'Instructions for the agent...',
  model: 'openai/gpt-4-turbo',
});
```

> See [Model Providers](/docs/models) and [Model Capabilities](/docs/models) for more information.

## Streaming

The recommended way of using Mastra and AI SDK together is by installing the `@mastra/ai-sdk` package. `@mastra/ai-sdk` provides custom API routes and utilities for streaming Mastra agents in AI SDK-compatible formats. Including chat, workflow, and network route handlers, along with utilities and exported types for UI integrations.

<Tabs>
  <TabItem value="npm" label="npm">
    ```bash copy
    npm install @mastra/ai-sdk
    ```
  </TabItem>
  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn add @mastra/ai-sdk
    ```
  </TabItem>
  <TabItem value="pnpm" label="pnpm">
    ```bash copy
    pnpm add @mastra/ai-sdk
    ```
  </TabItem>
  <TabItem value="bun" label="bun">
    ```bash copy
    bun add @mastra/ai-sdk
    ```
  </TabItem>
</Tabs>

### `chatRoute()`

When setting up a [custom API route](/docs/server-db/custom-api-routes), use the `chatRoute()` utility to create a route handler that automatically formats the agent stream into an AI SDK-compatible format.

```typescript filename="src/mastra/index.ts" copy
import { Mastra } from '@mastra/core/mastra';
import { chatRoute } from '@mastra/ai-sdk';

export const mastra = new Mastra({
  server: {
    apiRoutes: [
      chatRoute({
        path: '/chat',
        agent: 'weatherAgent',
      }),
    ],
  },
});
```

Once you have your `/chat` API route set up, you can call the `useChat()` hook in your application.

```typescript
const { error, status, sendMessage, messages, regenerate, stop } = useChat({
  transport: new DefaultChatTransport({
    api: 'http://localhost:4111/chat',
  }),
});
```

Pass extra agent stream execution options:

```typescript
const { error, status, sendMessage, messages, regenerate, stop } = useChat({
  transport: new DefaultChatTransport({
    api: 'http://localhost:4111/chat',
    prepareSendMessagesRequest({ messages }) {
      return {
        body: {
          messages,
          // Pass memory config
          memory: {
            thread: 'user-1',
            resource: 'user-1',
          },
        },
      };
    },
  }),
});
```

### `workflowRoute()`

Use the `workflowRoute()` utility to create a route handler that automatically formats the workflow stream into an AI SDK-compatible format.

```typescript filename="src/mastra/index.ts" copy
import { Mastra } from '@mastra/core/mastra';
import { workflowRoute } from '@mastra/ai-sdk';

export const mastra = new Mastra({
  server: {
    apiRoutes: [
      workflowRoute({
        path: '/workflow',
        agent: 'weatherAgent',
      }),
    ],
  },
});
```

Once you have your `/workflow` API route set up, you can call the `useChat()` hook in your application.

```typescript
const { error, status, sendMessage, messages, regenerate, stop } = useChat({
  transport: new DefaultChatTransport({
    api: 'http://localhost:4111/workflow',
    prepareSendMessagesRequest({ messages }) {
      return {
        body: {
          inputData: {
            city: messages[messages.length - 1].parts[0].text,
          },
        },
      };
    },
  }),
});
```

### `networkRoute()`

Use the `networkRoute()` utility to create a route handler that automatically formats the agent network stream into an AI SDK-compatible format.

```typescript filename="src/mastra/index.ts" copy
import { Mastra } from '@mastra/core/mastra';
import { networkRoute } from '@mastra/ai-sdk';

export const mastra = new Mastra({
  server: {
    apiRoutes: [
      networkRoute({
        path: '/network',
        agent: 'weatherAgent',
      }),
    ],
  },
});
```

Once you have your `/network` API route set up, you can call the `useChat()` hook in your application.

```typescript
const { error, status, sendMessage, messages, regenerate, stop } = useChat({
  transport: new DefaultChatTransport({
    api: 'http://localhost:4111/network',
  }),
});
```

### Custom UI

The `@mastra/ai-sdk` package transforms and emits Mastra streams (e.g workflow, network streams) into AI SDK-compatible [uiMessages DataParts](https://ai-sdk.dev/docs/reference/ai-sdk-core/ui-message#datauipart) format.

- **Top-level parts**: These are streamed via direct workflow and network stream transformations (e.g in `workflowRoute()` and `networkRoute()`)
  - `data-workflow`: Aggregates a workflow run with step inputs/outputs and final usage.
  - `data-network`: Aggregates a routing/network run with ordered steps (agent/workflow/tool executions) and outputs.

- **Nested parts**: These are streamed via nested and merged streams from within a tool's `execute()` method.
  - `data-tool-workflow`: Nested workflow emitted from within a tool stream.
  - `data-tool-network`: Nested network emitted from within an tool stream.
  - `data-tool-agent`: Nested agent emitted from within an tool stream.

Here's an example: For a [nested agent stream within a tool](/docs/streaming/tool-streaming#tool-using-an-agent), `data-tool-agent` UI message parts will be emitted and can be leveraged on the client as documented below:

```typescript filename="app/page.tsx" copy
"use client";

import { useChat } from "@ai-sdk/react";
import { AgentTool } from '../ui/agent-tool';
import type { AgentDataPart } from "@mastra/ai-sdk";

export default function Page() {
  const { messages } = useChat({
    transport: new DefaultChatTransport({
    api: 'http://localhost:4111/chat',
    }),
  });

  return (
    <div>
      {messages.map((message) => (
        <div key={message.id}>
          {message.parts.map((part, i) => {
            switch (part.type) {
              case 'data-tool-agent':
                return (
                  <AgentTool {...part.data as AgentDataPart} key={`${message.id}-${i}`} />
                );
              default:
                return null;
            }
          })}
        </div>
      ))}
    </div>
  );
}
```

```typescript filename="ui/agent-tool.ts" copy
import { Tool, ToolContent, ToolHeader, ToolOutput } from "../ai-elements/tool";
import type { AgentDataPart } from "@mastra/ai-sdk";

export const AgentTool = ({ id, text, status }: AgentDataPart) => {
  return (
    <Tool>
      <ToolHeader
        type={`${id}`}
        state={status === 'finished' ? 'output-available' : 'input-available'}
      />
      <ToolContent>
        <ToolOutput output={text} />
      </ToolContent>
    </Tool>
  );
};
```

### Custom Tool streaming

To stream custom data parts from within your tool execution function, use the
`writer.custom()` method.

```typescript {5,8,15} showLineNumbers copy
import { createTool } from "@mastra/core/tools";

export const testTool = createTool({
  // ...
  execute: async ({ context, writer }) => {
    const { value } = context;

   await writer?.custom({
      type: "data-tool-progress",
      status: "pending"
    });

    const response = await fetch(...);

   await writer?.custom({
      type: "data-tool-progress",
      status: "success"
    });

    return {
      value: ""
    };
  }
});
```

For more information about tool streaming see [Tool streaming documentation](/docs/streaming/tool-streaming)

### Stream Transformations

To manually transform Mastra's streams to AI SDK-compatible format, use the `toAISdkFormat()` utility.

```typescript filename="app/api/chat/route.ts" copy {3,13}
import { mastra } from '../../mastra';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { toAISdkFormat } from '@mastra/ai-sdk';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const myAgent = mastra.getAgent('weatherAgent');
  const stream = await myAgent.stream(messages);

  // Transform stream into AI SDK format and create UI messages stream
  const uiMessageStream = createUIMessageStream({
    execute: async ({ writer }) => {
      for await (const part of toAISdkFormat(stream, { from: 'agent' })!) {
        writer.write(part);
      }
    },
  });

  // Create a Response that streams the UI message stream to the client
  return createUIMessageStreamResponse({
    stream: uiMessageStream,
  });
}
```

### Client Side Stream Transformations

If you have a client-side `response` from `agent.stream(...)` and want AI SDK-formatted parts without custom SSE parsing, wrap `response.processDataStream` into a `ReadableStream<ChunkType>` and pipe it through `toAISdkFormat`:

```typescript filename="client-stream-to-ai-sdk.ts" copy
import { createUIMessageStream } from 'ai';
import { toAISdkFormat } from '@mastra/ai-sdk';
import type { ChunkType, MastraModelOutput } from '@mastra/core/stream';

// Client SDK agent stream
const response = await agent.stream({
  messages: 'What is the weather in Tokyo',
});

const chunkStream: ReadableStream<ChunkType> = new ReadableStream<ChunkType>({
  start(controller) {
    response
      .processDataStream({
        onChunk: async chunk => {
          controller.enqueue(chunk as ChunkType);
        },
      })
      .finally(() => controller.close());
  },
});

const uiMessageStream = createUIMessageStream({
  execute: async ({ writer }) => {
    for await (const part of toAISdkFormat(chunkStream as unknown as MastraModelOutput, { from: 'agent' })) {
      writer.write(part);
    }
  },
});

for await (const part of uiMessageStream) {
  console.log(part);
}
```

## UI Hooks

Mastra supports AI SDK UI hooks for connecting frontend components directly to agents using HTTP streams.

Install the required AI SDK React package:

<Tabs>
  <TabItem value="npm" label="npm">
    ```bash copy
    npm install @ai-sdk/react
    ```
  </TabItem>
  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn add @ai-sdk/react
    ```
  </TabItem>
  <TabItem value="pnpm" label="pnpm">
    ```bash copy
    pnpm add @ai-sdk/react
    ```
  </TabItem>
  <TabItem value="bun" label="bun">
    ```bash copy
    bun add @ai-sdk/react
    ```
  </TabItem>
</Tabs>

### Using `useChat()`

The `useChat()` hook handles real-time chat interactions between your frontend and a Mastra agent, enabling you to send prompts and receive streaming responses over HTTP.

```typescript {8-12} filename="app/test/chat.tsx" copy
"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";

export function Chat() {
  const [inputValue, setInputValue] = useState('')
  const { messages, sendMessage} = useChat({
    transport: new DefaultChatTransport({
      api: 'http://localhost:4111/chat',
    }),
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage({ text: inputValue });
  };

  return (
    <div>
      <pre>{JSON.stringify(messages, null, 2)}</pre>
      <form onSubmit={handleFormSubmit}>
        <input value={inputValue} onChange={e=>setInputValue(e.target.value)} placeholder="Name of city" />
      </form>
    </div>
  );
}
```

Requests sent using the `useChat()` hook are handled by a standard server route. This example shows how to define a POST route using a Next.js Route Handler.

```typescript filename="app/api/chat/route.ts" copy
import { mastra } from '../../mastra';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const myAgent = mastra.getAgent('weatherAgent');
  const stream = await myAgent.stream(messages, { format: 'aisdk' });

  return stream.toUIMessageStreamResponse();
}
```

> When using `useChat()` with agent memory, refer to the [Agent Memory section](/docs/agents/agent-memory#memory-in-agent-calls) for key implementation details.

### Using `useCompletion()`

The `useCompletion()` hook handles single-turn completions between your frontend and a Mastra agent, allowing you to send a prompt and receive a streamed response over HTTP.

```typescript {6-8} filename="app/test/completion.tsx" copy
"use client";

import { useCompletion } from "@ai-sdk/react";

export function Completion() {
  const { completion, input, handleInputChange, handleSubmit } = useCompletion({
    api: "api/completion"
  });

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} placeholder="Name of city" />
      </form>
      <p>Completion result: {completion}</p>
    </div>
  );
}
```

Requests sent using the `useCompletion()` hook are handled by a standard server route. This example shows how to define a POST route using a Next.js Route Handler.

```typescript filename="app/api/completion/route.ts" copy
import { mastra } from '../../../mastra';

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const myAgent = mastra.getAgent('weatherAgent');
  const stream = await myAgent.stream([{ role: 'user', content: prompt }], {
    format: 'aisdk',
  });

  return stream.toUIMessageStreamResponse();
}
```

### Passing additional data

`sendMessage()` allows you to pass additional data from the frontend to Mastra. This data can then be used on the server as `RuntimeContext`.

```typescript {16-26} filename="app/test/chat-extra.tsx" copy
"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";

export function ChatExtra() {
  const [inputValue, setInputValue] = useState('')
  const { messages, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: 'http://localhost:4111/chat',
    }),
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage({ text: inputValue }, {
      body: {
        data: {
          userId: "user123",
          preferences: {
            language: "en",
            temperature: "celsius"
          }
        }
      }
    });
  };

  return (
    <div>
      <pre>{JSON.stringify(messages, null, 2)}</pre>
      <form onSubmit={handleFormSubmit}>
        <input value={inputValue} onChange={e=>setInputValue(e.target.value)} placeholder="Name of city" />
      </form>
    </div>
  );
}
```

```typescript {8,12} filename="app/api/chat-extra/route.ts" copy
import { mastra } from '../../../mastra';
import { RuntimeContext } from '@mastra/core/runtime-context';

export async function POST(req: Request) {
  const { messages, data } = await req.json();
  const myAgent = mastra.getAgent('weatherAgent');

  const runtimeContext = new RuntimeContext();

  if (data) {
    for (const [key, value] of Object.entries(data)) {
      runtimeContext.set(key, value);
    }
  }

  const stream = await myAgent.stream(messages, {
    runtimeContext,
    format: 'aisdk',
  });
  return stream.toUIMessageStreamResponse();
}
```

### Handling `runtimeContext` with `server.middleware`

You can also populate the `RuntimeContext` by reading custom data in a server middleware:

```typescript {8,17} filename="mastra/index.ts" copy
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  agents: { weatherAgent },
  server: {
    middleware: [
      async (c, next) => {
        const runtimeContext = c.get('runtimeContext');

        if (c.req.method === 'POST') {
          try {
            const clonedReq = c.req.raw.clone();
            const body = await clonedReq.json();

            if (body?.data) {
              for (const [key, value] of Object.entries(body.data)) {
                runtimeContext.set(key, value);
              }
            }
          } catch {}
        }
        await next();
      },
    ],
  },
});
```

> You can then access this data in your tools via the `runtimeContext` parameter. See the [Runtime Context documentation](/docs/server-db/runtime-context) for more details.

## Migrating from AI SDK v4 to v5

Follow the official [AI SDK v5 Migration Guide](https://v5.ai-sdk.dev/docs/migration-guides/migration-guide-5-0) for all AI SDK core breaking changes, package updates, and API changes.

This guide covers only the Mastra-specific aspects of the migration.

- **Data compatibility**: New data stored in v5 format will no longer work if you downgrade from v5 to v4
- **Backup recommendation**: Keep DB backups from before you upgrade to v5

### Memory and Storage

Mastra automatically handles AI SDK v4 data using its internal `MessageList` class, which manages format conversion—including v4 to v5. No database migrations are required; your existing messages are translated on the fly and continue working after you upgrade.

### Message Format Conversion

For cases where you need to manually convert messages between AI SDK and Mastra formats, use the `convertMessages()` utility:

```typescript
import { convertMessages } from '@mastra/core/agent';

// Convert AI SDK v4 messages to v5
const aiv5Messages = convertMessages(aiv4Messages).to('AIV5.UI');

// Convert Mastra messages to AI SDK v5
const aiv5Messages = convertMessages(mastraMessages).to('AIV5.Core');

// Supported output formats:
// 'Mastra.V2', 'AIV4.UI', 'AIV5.UI', 'AIV5.Core', 'AIV5.Model'
```

This utility is helpful when you want to fetch messages directly from your storage DB and convert them for use in AI SDK.

### Type Inference for Tools

When using tools with TypeScript in AI SDK v5, Mastra provides type inference helpers to ensure type safety for your tool inputs and outputs.

#### `InferUITool`

The `InferUITool` type helper infers the input and output types of a single Mastra tool:

```typescript filename="app/types.ts" copy
import { InferUITool, createTool } from '@mastra/core/tools';
import { z } from 'zod';

const weatherTool = createTool({
  id: 'get-weather',
  description: 'Get the current weather',
  inputSchema: z.object({
    location: z.string().describe('The city and state'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    conditions: z.string(),
  }),
  execute: async ({ context }) => {
    return {
      temperature: 72,
      conditions: 'sunny',
    };
  },
});

// Infer the types from the tool
type WeatherUITool = InferUITool<typeof weatherTool>;
// This creates:
// {
//   input: { location: string };
//   output: { temperature: number; conditions: string };
// }
```

#### `InferUITools`

The `InferUITools` type helper infers the input and output types of multiple tools:

```typescript filename="app/mastra/tools.ts" copy
import { InferUITools, createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Using weatherTool from the previous example
const tools = {
  weather: weatherTool,
  calculator: createTool({
    id: 'calculator',
    description: 'Perform basic arithmetic',
    inputSchema: z.object({
      operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
      a: z.number(),
      b: z.number(),
    }),
    outputSchema: z.object({
      result: z.number(),
    }),
    execute: async ({ context }) => {
      // implementation...
      return { result: 0 };
    },
  }),
};

// Infer types from the tool set
export type MyUITools = InferUITools<typeof tools>;
// This creates:
// {
//   weather: { input: { location: string }; output: { temperature: number; conditions: string } };
//   calculator: { input: { operation: "add" | "subtract" | "multiply" | "divide"; a: number; b: number }; output: { result: number } };
// }
```

These type helpers provide full TypeScript support when using Mastra tools with AI SDK v5 UI components, ensuring type safety across your application.
