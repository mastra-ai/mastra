---
'@mastra/factory': patch
---

Platform-connected GitLab deployments now receive issue, note, merge request and push events by polling the Platform event log, so they no longer need a direct project webhook to Factory or a shared `MASTRA_GITLAB_WEBHOOK_SECRET`. Polling is on by default and controlled with `MASTRA_PLATFORM_GITLAB_POLLING_ENABLED` and `MASTRA_PLATFORM_GITLAB_POLLING_INTERVAL_MS`.

A Platform-connected deployment needs no webhook configuration; polling starts with the integration:

```ts
import { PlatformGitLabIntegration } from '@mastra/factory/integrations/platform/gitlab/integration';

// Discovers every active Platform GitLab connection and polls its event log.
const gitlab = new PlatformGitLabIntegration();

// Tune or disable polling per deployment instead of through the environment.
const quiet = new PlatformGitLabIntegration({ pollingIntervalMs: 60_000 });
const webhookOnly = new PlatformGitLabIntegration({ pollingEnabled: false });
```
