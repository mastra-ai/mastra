---
'@mastra/core': minor
---

Added SignalProvider abstraction for building notification signal providers. Enables declarative signal wiring in Agent config with built-in subscription tracking, polling lifecycle, and webhook support. Includes WebhookSignalProvider as a proof-of-concept.

**Basic usage:**

```ts
import { Agent } from '@mastra/core/agent';
import { WebhookSignalProvider } from '@mastra/core/signals';

const webhookProvider = new WebhookSignalProvider({
  extractResourceId: (payload) => payload.repository,
});

const agent = new Agent({
  signals: [webhookProvider],
  // ... other config
});

// Subscribe a thread to an external resource
webhookProvider.subscribeThread(
  { threadId: 'thread-1', resourceId: 'user-1' },
  'my-org/my-repo'
);

// Handle incoming webhooks
await webhookProvider.handleWebhook({
  body: { repository: 'my-org/my-repo', status: 'completed' },
  headers: {},
});
```
