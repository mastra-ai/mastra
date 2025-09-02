# @mastra/ai-sdk

Setup custom API routes to support `useChat` from packages similar to @ai-sdk/react.

## Installation

```bash
npm install @mastra/ai-sdk
```

## Usage

If you want to use dynamic agents you can use a path with :agentId.

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

Or you can create a fixed one:

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

In your application you can simply call the useChat hook.

```
type MyMessage = {}
const { error, status, sendMessage, messages, regenerate, stop } =
  useChat<MyMessage>({
    transport: new DefaultChatTransport({
      api: 'http://localhost:4111/chat/weatherAgent',
    })
  });
```
