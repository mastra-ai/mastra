---
'@mastra/factory': minor
---

Added platform-managed Jira intake for Factory deployments. With `MASTRA_PLATFORM_ACCESS_TOKEN` or `MASTRA_PLATFORM_SECRET_KEY` configured, Factory automatically discovers visible Platform connections by filtering for the `factory-jira` provider configuration key and routes Jira Cloud requests through them.

An explicitly configured `JiraIntegration` continues to take precedence, so self-hosted Jira credentials and Platform-managed connections use the same Jira client behavior without conflicting.

```bash
MASTRA_PLATFORM_ACCESS_TOKEN=platform-access-token
```

```ts
import { MastraFactory } from '@mastra/factory';

// Platform Jira is registered automatically when Platform credentials are set.
export const factory = new MastraFactory({ storage });
```
