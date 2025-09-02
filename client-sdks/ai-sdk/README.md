# @mastra/ai-sdk

`@mastra/ai-sdk` helps you setup custom API routes to more easily support [`useChat()`](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat).

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
