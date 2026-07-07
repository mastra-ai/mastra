---
'@mastra/slack': minor
---

Added `SlackSignals`, a polling signal provider that wakes agent threads when new messages arrive in subscribed Slack conversations. It authorizes your Slack user account (not a bot), so it can watch any thread, channel, or DM you can see — with no webhooks, tunnels, or public endpoints required.

```ts
import { Agent } from '@mastra/core/agent';
import { SlackSignals } from '@mastra/slack';

const agent = new Agent({
  id: 'my-agent',
  name: 'My Agent',
  model: 'openai/gpt-4.1',
  instructions: 'Watch Slack threads and follow up on replies.',
  signals: [new SlackSignals()],
});
```

The agent gets `slack_subscribe_thread`, `slack_unsubscribe_thread`, and `slack_list_subscriptions` tools to manage its own subscriptions. Subscriptions and last-seen cursors persist on thread metadata, so restarts never re-deliver old messages.

Auth uses `SlackUserAuth` (a browser OAuth flow with automatic token refresh), or pass a static `token` for headless and CI environments.
