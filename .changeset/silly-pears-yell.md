---
'@mastra/factory': minor
---

Added a built-in Slack integration, so every factory and create-factory deployment can offer Slack channels without vendoring the integration itself. Register it alongside the built-in GitHub and Linear integrations:

```ts
import { SlackIntegration } from '@mastra/factory/integrations/slack/integration';

new MastraFactory({
  integrations: [new SlackIntegration({ signingSecret, botToken, clientId, clientSecret })],
});
```

Slack-started sessions are repo-backed automatically: the factory exposes its source-control owner on `IntegrationContext` (`ctx.storage.sourceControlOwner`) and the integration wires itself up from there.

Two related changes come with it. `FactoryIntegration.channels()` now returns a config object (`FactoryChannelsConfig`) instead of a built `AgentControllerChannels` instance, and the factory constructs the instance at the attach site. And when no Slack integration is registered, the factory answers `GET /web/channel-accounts` with `{ accounts: [], canConnect: false, reason: 'not_registered' }`, so the Connections UI can say Slack is not set up instead of telling you to set environment variables that would not enable it.
