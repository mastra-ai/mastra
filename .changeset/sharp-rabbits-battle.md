---
'@mastra/react': minor
---

Added `clientTools` option to `useChat` for forwarding browser-side tools to the agent on each generate/stream call.

```tsx
import { useChat } from '@mastra/react';

const { messages, sendMessage } = useChat({
  agentId: 'my-agent',
  clientTools: {
    showToast: {
      description: 'Show a toast to the user',
      inputSchema: z.object({ message: z.string() }),
      execute: ({ message }) => toast(message),
    },
  },
});
```

Client tools are forwarded as-is to the underlying `agent.generate()` and `agent.stream()` calls.
