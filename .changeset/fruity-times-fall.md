---
'@mastra/react': patch
---

Added additive system context support to React agent requests so per-turn state can preserve configured agent instructions.

```tsx
import { useChat } from '@mastra/react';

function Chat() {
  const { sendMessage } = useChat({ agentId: 'my-agent' });

  // `system` is appended to the agent's configured instructions
  // instead of replacing them like `instructions` does.
  const send = () =>
    sendMessage({
      message: 'Continue',
      modelSettings: { system: 'Current form state: ...' },
    });

  return <button onClick={send}>Send</button>;
}
```
