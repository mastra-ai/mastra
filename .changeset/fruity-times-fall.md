---
'@mastra/react': patch
---

Added additive system context support to React agent requests so per-turn state can preserve configured agent instructions.

```ts
import { useChat } from '@mastra/react';

const { sendMessage } = useChat({ agentId: 'my-agent' });

// `system` is appended to the agent's configured instructions
// instead of replacing them like `instructions` does.
await sendMessage({
  message: 'Continue',
  modelSettings: { system: 'Current form state: ...' },
});
```
