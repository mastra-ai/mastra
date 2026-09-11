---
'@mastra/factory': minor
---

Added platform-managed Jira intake. Factory deployments with Platform credentials and `MASTRA_JIRA_CONNECTION_ID` proxy Jira requests through that connection in the Integrations API. An explicitly configured `jira` integration continues to take precedence for self-hosted deployments.

```ts
import { PlatformJiraIntegration } from '@mastra/factory/integrations/platform/jira/integration';

const jira = new PlatformJiraIntegration();
```
