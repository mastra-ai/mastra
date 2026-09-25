---
'@mastra/connect': minor
---

Added ten tool providers to @mastra/connect: Slack, GitHub, Google Mail, Google Calendar, Fireflies, PostHog, Stripe, Discord, Twitter/X, and HubSpot. Agents can now work across these services out of the box — query PostHog with HogQL, read Stripe balances and disputes, browse GitHub tags and trees, send Slack Connect shared-channel invites, search Twitter, and submit HubSpot forms. Attach a provider connection in Mastra Platform and the tools resolve through connect() with no extra configuration:

```ts
import { Agent } from '@mastra/core/agent';
import { connect } from '@mastra/connect';

const agent = new Agent({
  id: 'ops-agent',
  model: 'anthropic/claude-sonnet-4-6',
  tools: connect(),
});
```
