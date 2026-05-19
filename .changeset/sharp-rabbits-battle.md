---
'@mastra/react': minor
---

Added `clientTools` option to `useChat`'s `generate`/`stream` calls for forwarding browser-side tools to the agent on each invocation.

```tsx
import { useChat } from '@mastra/react';

const { generate } = useChat({ agentId: 'my-agent' });

await generate({
  messages: [{ role: 'user', content: 'Show a toast that says hi' }],
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
