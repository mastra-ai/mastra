---
'@mastra/factory': minor
---

Added platform-managed Jira intake. Factory deployments with Platform credentials now discover Jira connections for the caller's organization and proxy Jira requests through the Integrations API. An explicitly configured `jira` integration continues to take precedence for self-hosted deployments.

```ts
import { PlatformJiraIntegration } from '@mastra/factory/integrations/platform/jira/integration';

const jira = new PlatformJiraIntegration();
```
