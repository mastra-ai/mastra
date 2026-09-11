---
'@mastra/factory': minor
---

Added platform-managed Jira intake for Factory deployments. Set `MASTRA_JIRA_CONNECTION_ID` together with `MASTRA_PLATFORM_ACCESS_TOKEN` or `MASTRA_PLATFORM_SECRET_KEY` to route Jira Cloud requests through one explicit Platform connection without runtime connection discovery.

Factory automatically enables the platform integration when those environment variables are available. An explicitly configured `JiraIntegration` continues to take precedence, so self-hosted Jira credentials and Platform-managed connections use the same Jira client behavior without conflicting.

```bash
MASTRA_JIRA_CONNECTION_ID=jira-connection-id
MASTRA_PLATFORM_ACCESS_TOKEN=platform-access-token
```

```ts
import { MastraFactory } from '@mastra/factory';

// Platform Jira is registered automatically when the environment variables are set.
export const factory = new MastraFactory({ storage });
```
