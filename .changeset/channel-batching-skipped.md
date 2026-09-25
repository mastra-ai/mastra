---
'@mastra/core': patch
---

Fixed channel messages being dropped when `chatOptions.concurrency` uses `burst`, `debounce`, or `queue`. Messages the Chat SDK batches together now reach the agent in the order they were sent and are saved to memory. Consecutive messages from one sender are merged into one turn; each sender's messages run as their own turn under that sender's identity. Custom channel handlers can read the batched messages from `context.skipped`. Fixes #22496.

```ts
import { Agent } from '@mastra/core/agent';
import { createWhatsAppAdapter } from '@chat-adapter/whatsapp';

export const agent = new Agent({
  id: 'support-agent',
  name: 'Support Agent',
  instructions: 'You are a helpful assistant.',
  model: 'openai/gpt-5-mini',
  channels: {
    adapters: { whatsapp: createWhatsAppAdapter() },
    chatOptions: { concurrency: 'debounce' },
    handlers: {
      onDirectMessage: async (thread, message, defaultHandler, context) => {
        console.log(`${context.skipped.length} earlier messages were batched`);
        await defaultHandler(thread, message);
      },
    },
  },
});
```
