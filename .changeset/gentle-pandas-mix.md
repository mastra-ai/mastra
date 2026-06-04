---
'@mastra/core': minor
---

Added SignalProvider abstraction for building notification signal providers. Enables declarative signal wiring in Agent config with built-in subscription tracking, polling lifecycle, and webhook support. Includes WebhookSignalProvider as a proof-of-concept.

**Writing a signal provider:**

```ts
import { SignalProvider } from '@mastra/core/signals';
import type { SignalSubscription } from '@mastra/core/signals';

class SlackSignalProvider extends SignalProvider<'slack-signals'> {
  readonly id = 'slack-signals' as const;
  readonly pollInterval = 30_000; // poll every 30s

  async poll(subscriptions: SignalSubscription[]) {
    for (const sub of subscriptions) {
      const messages = await fetchNewMessages(sub.externalResourceId);
      if (messages.length > 0) {
        await this.notify(
          { source: 'slack', kind: 'new-message', summary: `${messages.length} new messages` },
          { threadId: sub.threadId, resourceId: sub.resourceId },
        );
      }
    }
  }
}
```

**Declarative wiring:**

```ts
import { Agent } from '@mastra/core/agent';

const agent = new Agent({
  signals: [new SlackSignalProvider()],
  // ... other config
});
```
