---
'@mastra/connect': minor
---

Added ten generated tool providers to @mastra/connect: Slack, GitHub, Google Mail, Google Calendar, Fireflies, PostHog, Stripe, Discord, Twitter/X, and HubSpot. Each ships checked-in tools generated from Nango integration templates, including new agent-focused actions (PostHog HogQL queries, Stripe balance/dispute/coupon/account reads, GitHub tags and trees, Slack Connect shared-channel invites, Twitter search and following lookups, HubSpot form submission). Attach a provider connection in Mastra Platform and the tools resolve through connect() with no extra configuration:

```ts
import { Agent } from '@mastra/core/agent';
import { connect } from '@mastra/connect';

const agent = new Agent({
  id: 'ops-agent',
  model: 'anthropic/claude-sonnet-4-6',
  tools: connect(),
});
```
