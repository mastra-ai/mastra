# @mastra/ai-sdk

The recommended way of using Mastra and AI SDK together is by installing the `@mastra/ai-sdk` package. `@mastra/ai-sdk` provides custom API routes and utilities for streaming Mastra agents in AI SDK-compatible formats. Including chat, workflow, and network route handlers, along with utilities and exported types for UI integrations.

## Installation

```bash
npm install @mastra/ai-sdk
```

## Usage

If you want to use dynamic agents you can use a path with `:agentId`.

```typescript
import { chatRoute } from '@mastra/ai-sdk';

export const mastra = new Mastra({
  server: {
    apiRoutes: [
      chatRoute({
        path: '/chat/:agentId',
      }),
    ],
  },
});
```

Or you can create a fixed route (i.e. `/chat`):

```typescript
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

After defining a dynamic route with `:agentId` you can use the `useChat()` hook like so:

```typescript
type MyMessage = {};

const { error, status, sendMessage, messages, regenerate, stop } = useChat<MyMessage>({
  transport: new DefaultChatTransport({
    api: 'http://localhost:4111/chat/weatherAgent',
  }),
});
```

`chatRoute()` forwards the incoming request `AbortSignal` to `agent.stream()`. If the client disconnects, Mastra aborts the in-flight generation. If you need generation to continue and persist server-side after disconnect, build a custom route around `agent.stream()`, avoid passing the request signal, and call `consumeStream()` on the returned `MastraModelOutput`.

### Workflow route

Stream a workflow in AI SDK-compatible format.

```typescript
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

### Network route

Stream agent networks (routing + nested agent/workflow/tool executions) in AI SDK-compatible format.

```typescript
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

## Framework-agnostic handlers

For use outside the Mastra server (e.g., Next.js App Router, Express), you can use the standalone handler functions directly. These handlers return a compatibility `ReadableStream` that can be passed to AI SDK response helpers like `createUIMessageStreamResponse` and `pipeUIMessageStreamToResponse`:

### handleChatStream

```typescript
import { handleChatStream } from '@mastra/ai-sdk';
import { createUIMessageStreamResponse } from 'ai';
import { mastra } from '@/src/mastra';

export async function POST(req: Request) {
  const params = await req.json();
  const stream = await handleChatStream({
    mastra,
    agentId: 'weatherAgent',
    params,
  });
  return createUIMessageStreamResponse({ stream });
}
```

### handleWorkflowStream

```typescript
import { handleWorkflowStream } from '@mastra/ai-sdk';
import { createUIMessageStreamResponse } from 'ai';
import { mastra } from '@/src/mastra';

export async function POST(req: Request) {
  const params = await req.json();
  const stream = await handleWorkflowStream({
    mastra,
    workflowId: 'myWorkflow',
    params,
  });
  return createUIMessageStreamResponse({ stream });
}
```

### handleNetworkStream

Pass AI SDK `UIMessage[]` from your installed `ai` version so TypeScript can infer the correct stream overload.

Handlers keep the existing v5/default behavior. If your app is typed against `ai@6`, pass `version: 'v6'`.

```typescript
import { handleNetworkStream } from '@mastra/ai-sdk';
import { createUIMessageStreamResponse, type UIMessage } from 'ai';
import { mastra } from '@/src/mastra';

export async function POST(req: Request) {
  const params = (await req.json()) as { messages: UIMessage[] };
  const stream = await handleNetworkStream({
    mastra,
    agentId: 'routingAgent',
    version: 'v6',
    params,
  });
  return createUIMessageStreamResponse({ stream });
}
```

## Agent versioning

All route handlers and standalone stream functions accept an optional `agentVersion` parameter to target a specific agent version. This requires the [Editor](https://mastra.ai/docs/editor/overview) to be configured.

Pass a version ID or resolve by status:

```typescript
chatRoute({
  path: '/chat',
  agent: 'weatherAgent',
  agentVersion: { status: 'published' },
});
```

For route handlers (`chatRoute`, `networkRoute`), callers can also override the version at request time with query parameters: `?versionId=<id>` or `?status=draft|published`. Query parameters take precedence over the static `agentVersion` option.

The standalone handlers (`handleChatStream`, `handleNetworkStream`) accept `agentVersion` directly:

```typescript
const stream = await handleChatStream({
  mastra,
  agentId: 'weatherAgent',
  agentVersion: { versionId: 'ver_abc123' },
  params,
});
```

## Manual transformation

If you have a raw Mastra `stream`, you can manually transform it to AI SDK UI message parts:

Use `toAISdkStream` for both versions. If your app is typed against `ai@6`, pass `version: 'v6'`.

```typescript
import { toAISdkStream } from '@mastra/ai-sdk';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const agent = mastra.getAgent('weatherAgent');
  const stream = await agent.stream(messages);

  // deduplicate messages https://ai-sdk.dev/docs/troubleshooting/repeated-assistant-messages
  const uiMessageStream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      for await (const part of toAISdkStream(stream, { from: 'agent' })) {
        writer.write(part);
      }
    },
  });

  return createUIMessageStreamResponse({ stream: uiMessageStream });
}
```

For AI SDK v6, select the v6 stream contract explicitly:

```typescript
const uiMessageStream = createUIMessageStream({
  originalMessages: messages,
  execute: async ({ writer }) => {
    for await (const part of toAISdkStream(stream, {
      from: 'agent',
      version: 'v6',
    })) {
      writer.write(part);
    }
  },
});
```

## Loading stored messages

Use `toAISdkMessages` from `@mastra/ai-sdk/ui` to convert stored Mastra messages for `useChat()` and other AI SDK UI hooks.

The helper keeps the existing v5/default behavior. If your app is typed against `ai@6`, pass `version: 'v6'`.
That uses the MessageList AI SDK v6 UI output path. MessageList input detection and ingestion remain unchanged.

```typescript
import { toAISdkMessages } from '@mastra/ai-sdk/ui';

const v5Messages = toAISdkMessages(storedMessages);
const v6Messages = toAISdkMessages(storedMessages, { version: 'v6' });
```
