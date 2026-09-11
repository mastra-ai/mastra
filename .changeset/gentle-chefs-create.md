---
'@mastra/factory': minor
---

Added platform-managed Jira intake for Factory deployments. Set `MASTRA_JIRA_CONNECTION_ID` together with `MASTRA_PLATFORM_ACCESS_TOKEN` or `MASTRA_PLATFORM_SECRET_KEY` to route Jira Cloud requests through one explicit Platform connection without runtime connection discovery.

Factory automatically enables the platform integration when those environment variables are available. An explicitly configured `JiraIntegration` continues to take precedence, so self-hosted Jira credentials and Platform-managed connections use the same Jira client behavior without conflicting.

```ts
import { PlatformJiraIntegration } from '@mastra/factory/integrations/platform/jira/integration';

const jira = new PlatformJiraIntegration({
  connectionId: 'jira-connection-id',
});
```
