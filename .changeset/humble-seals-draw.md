---
'@mastra/factory': minor
---

Added direct and Platform-managed GitLab issue intake. Factory deployments can list GitLab projects, ingest issues, read discussions, add comments, and update issue state.

```ts
import { GitLabIntegration } from '@mastra/factory/integrations/gitlab/integration';

const gitlab = new GitLabIntegration({
  baseUrl: 'https://gitlab.example.com',
  accessToken: process.env.GITLAB_ACCESS_TOKEN!,
});
```

When Platform credentials are configured, Factory automatically uses organization-scoped GitLab connections through the integrations v2 proxy instead.
