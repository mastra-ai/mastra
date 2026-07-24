---
'@mastra/core': minor
---

Added channel account linking so inbound chat messages can resolve to a specific tenant. `AgentControllerChannels` now accepts a resolver that maps a platform sender (Slack team + user id) to a Mastra tenant, and stamps that tenant onto the run so per-tenant model credentials resolve for channel runs.

**New public API on @mastra/core/channels**

```ts
import { AgentControllerChannels } from '@mastra/core/channels';

const channels = new AgentControllerChannels({ adapters, handlers });

// Map a platform sender to a Mastra tenant. Return null for unlinked senders.
channels.setAccountLinkResolver(async ({ platform, teamId, userId }) => {
  const link = await lookupLink(platform, teamId, userId);
  return link ? { orgId: link.orgId, userId: link.userId } : null;
});

// Optional: prompt an unlinked sender to connect their account.
channels.setUnlinkedSenderHandler(async sender => {
  await sendConnectPrompt(sender);
});
```

When a resolver is set, a linked sender's run resolves their stored model credentials; an unlinked sender's run is skipped. `ChannelContext` also gains a `teamId` field carrying the platform team/workspace id. Existing channels with no resolver are unaffected.
