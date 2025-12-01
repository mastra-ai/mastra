---
'@mastra/ai-sdk': minor
---

Add framework-agnostic stream handlers for use outside of Hono/Mastra server

- `handleChatStream`: Standalone handler for streaming agent chat in AI SDK format
- `handleWorkflowStream`: Standalone handler for streaming workflow execution in AI SDK format
- `handleNetworkStream`: Standalone handler for streaming agent network execution in AI SDK format
  These functions accept all arguments explicitly and return a `ReadableStream`, making them usable in any framework (Next.js App Router, Express, etc.) without depending on Hono context.

Example usage:

```typescript
import { handleChatStream } from '@mastra/ai-sdk';
import { createUIMessageStreamResponse } from 'ai';
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

New exports:

- handleChatStream, ChatStreamHandlerParams, ChatStreamHandlerOptions
- handleWorkflowStream, WorkflowStreamHandlerParams, WorkflowStreamHandlerOptions
- handleNetworkStream, NetworkStreamHandlerParams, NetworkStreamHandlerOptions
