---
'@mastra/ring-signals': minor
---

Added `@mastra/ring-signals` for connecting Ring doorbells and cameras to Mastra agents. Ring events such as doorbell presses and motion arrive in agent threads as notification signals, and the agent can fetch a snapshot or video clip for an event with the `ring_snapshot` and `ring_clip` tools.

```ts
import { Agent } from '@mastra/core/agent';
import { RingSignals } from '@mastra/ring-signals';

export const homeAgent = new Agent({
  id: 'home-agent',
  name: 'Home Agent',
  instructions: 'Say briefly whether each doorbell event needs attention.',
  model: 'openai/gpt-6.1-sol',
  signals: [
    new RingSignals({
      events: {
        device_offline: { priority: 'low', summary: 'Device went offline.', coalesce: true },
      },
    }),
  ],
});
```

Mastra adds the routes Ring calls for account linking and webhooks to the server. See the [Ring integration guide](https://mastra.ai/integrations/channels/ring).
