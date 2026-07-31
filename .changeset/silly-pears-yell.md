---
'@mastra/factory': minor
---

Added the Slack integration to `@mastra/factory`, so every factory and create-factory deployment can offer Slack channels out of the box. Import it from the new subpath and register it like the built-in GitHub and Linear integrations:

```ts
import { SlackIntegration } from '@mastra/factory/integrations/slack/integration';

new MastraFactory({
  integrations: [new SlackIntegration({ signingSecret, botToken, clientId, clientSecret })],
});
```

**Slack sessions wire up source control automatically.** The factory now exposes its source-control owner on `IntegrationContext` (`ctx.storage.sourceControlOwner`), and the Slack integration uses it to make Slack-started sessions repo-backed. The `sourceControl` config field is gone — you no longer hand-wire a GitHub adapter into the Slack integration:

```ts
// Before
new SlackIntegration({ ...secrets, sourceControl: github ? createGithubSourceControl(github) : undefined });

// After
new SlackIntegration({ ...secrets });
```

**`FactoryIntegration.channels()` now returns a config object** (`FactoryChannelsConfig`) instead of a built `AgentControllerChannels` instance; the factory constructs the instance at the attach site. Adapter-map entries must use the config form (`{ adapter, ... }`) — the bare adapter-instance shorthand core accepts is deliberately excluded so future per-platform options have a home. One integration providing one platform entry is the norm; the factory still rejects more than one channels-providing integration.

**Honest "not configured" answer for Slack.** When no Slack integration is registered, the factory serves a stub for `GET /web/channel-accounts` answering `{ accounts: [], canConnect: false, reason: 'not_registered' }`, so the Connections UI can say the integration is not registered instead of wrongly claiming environment variables are missing.
