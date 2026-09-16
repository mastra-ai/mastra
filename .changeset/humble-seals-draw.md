---
'@mastra/factory': minor
---

Added GitLab as a full Factory source-control provider in direct and Platform-managed deployments.

- Intake can discover GitLab projects, ingest issues, read discussions, add comments, update issue state, and route selected projects to factories from the Settings UI.
- Version control can register repositories, provide authenticated clone access, manage the merge request lifecycle, create and edit merge request comments, manage diff-anchored review discussions, and add or remove individual reviewers.
- Webhook ingress verifies `X-Gitlab-Token` and accepts supported issue, note, merge request, and push events through a best-effort ingestion seam.

GitLab approvals are exposed as an approval snapshot and are used for submitted `approve` reviews; submitted `comment` reviews become merge request notes. GitLab has no equivalent for mutable pending reviews, request-changes reviews, approval dismissal, or team review requests, so those operations fail explicitly with a not-supported response. Fetching one review returns no result because approvals do not have stable review objects.

```ts
import { GitLabIntegration } from '@mastra/factory/integrations/gitlab/integration';

const gitlab = new GitLabIntegration({
  baseUrl: 'https://gitlab.example.com',
  accessToken: process.env.GITLAB_ACCESS_TOKEN!,
  webhookSecret: process.env.GITLAB_WEBHOOK_SECRET,
});
```

When Platform credentials are configured, Factory automatically uses organization-scoped GitLab connections through the integrations v2 proxy instead.
