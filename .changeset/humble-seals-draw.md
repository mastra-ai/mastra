---
'@mastra/factory': minor
---

Added GitLab intake, merge-request version control, and webhook support to direct and Platform-managed Factory deployments. Both credential modes can use GitLab repositories to back Factory sessions.

- Intake can discover GitLab projects, ingest issues, read discussions, add comments, update issue state, and route selected projects to factories from the Settings UI.
- Version control can register repositories, manage the merge request lifecycle, create and edit merge request comments, manage diff-anchored review discussions, and add or remove individual reviewers. Direct tokens and fresh Platform connection credentials provide authenticated clone access for repository-backed sessions.
- Webhook ingress verifies `X-Gitlab-Token` and routes supported issue, note, and merge request events into Factory rules. Unsupported events, including push events, are acknowledged without changing board state.

GitLab approvals are exposed as an approval snapshot and are used for submitted `approve` reviews; submitted `comment` reviews become merge request notes. Individual listed approvals and comment reviews can be fetched through synthetic review IDs. GitLab has no equivalent for mutable pending reviews, request-changes reviews, approval dismissal, or team review requests, so those operations fail explicitly with a not-supported response.

```ts
import { GitLabIntegration } from '@mastra/factory/integrations/gitlab/integration';

const gitlab = new GitLabIntegration({
  baseUrl: 'https://gitlab.example.com',
  accessToken: process.env.GITLAB_ACCESS_TOKEN!,
  accessTokenType: 'group', // Or 'personal'.
  webhookSecret: process.env.GITLAB_WEBHOOK_SECRET,
});
```

Direct mode reads the same values from `GITLAB_ACCESS_TOKEN`, `GITLAB_ACCESS_TOKEN_TYPE`, `GITLAB_BASE_URL`, and `GITLAB_WEBHOOK_SECRET` when constructor options are omitted. Personal and Group Access Tokens are both supported; use `api` and `write_repository` scopes.

When Platform credentials and `MASTRA_GITLAB_CONNECTION_ID` are configured, Factory uses that organization-scoped GitLab connection through `/v2/connections/{connectionId}/proxy`. Explicit direct credentials take precedence. Platform-managed clone and push resolve a fresh repository credential for the selected connection; the connection selector itself is never used as a Git token.
