# @mastra/ai-sdk

`@mastra/ai-sdk` provides custom API routed and utilities to stream Mastra agents in AI SDK v5 compatible formats. It includes chat, workflow, and network route handlers, plus utilities and exported types for UI integrations.

## Installation

```bash
npm install @mastra/ai-sdk
```

## Exports

```ts
import {
  chatRoute,
  workflowRoute,
  networkRoute,
  toAISdkFormat,
  type chatRouteOptions,
  type WorkflowRouteOptions,
  type NetworkRouteOptions,
  type WorkflowDataPart,
  type NetworkDataPart,
  type AgentDataPart,
} from '@mastra/ai-sdk';
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

## Workflow route

Stream a workflow in AI SDK compatible format.

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

## Network route

Stream agent networks (routing + nested agent/workflow/tool executions) in AI SDK compatible format.

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

## Manual transformation

If you have a raw Mastra `stream`, you can manually transform it to AI SDK UI message parts:

```typescript
import { toAISdkFormat } from '@mastra/ai-sdk';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const agent = mastra.getAgent('weatherAgent');
  const stream = await agent.stream(messages);

  const uiMessageStream = createUIMessageStream({
    execute: async ({ writer }) => {
      for await (const part of toAISdkFormat(stream, { from: 'agent' })!) {
        writer.write(part);
      }
    },
  });

  return createUIMessageStreamResponse({ stream: uiMessageStream });
}
```

## Types

- `WorkflowDataPart`: Emitted for workflow runs and nested tool-workflows.
- `NetworkDataPart`: Emitted for network runs and nested tool-networks.
- `AgentDataPart`: Aggregated agent step data for nested agent progress.
- `chatRouteOptions`, `WorkflowRouteOptions`, `NetworkRouteOptions`: Route configuration types.
