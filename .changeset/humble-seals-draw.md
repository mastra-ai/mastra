---
'@mastra/factory': minor
---

Added GitLab as a Factory source-control and work-intake provider for direct and Platform-managed deployments, with the same session, board, review, and notification behaviour that GitHub repositories get. Both credential modes can back Factory sessions with GitLab repositories.

- Intake discovers GitLab projects, ingests issues with labels, label colours, assignees, weight-derived priority, and comment counts, reads discussions, adds comments, updates issue state, and routes selected projects to factories from the Settings UI. GitLab issue and GitHub issue routing are stored separately.
- Version control registers repositories, manages the merge request lifecycle, creates and edits merge request notes, manages diff-anchored review discussions, and adds or removes individual reviewers. Direct tokens and Platform connection credentials both provide authenticated clone and push for repository-backed sessions.
- Webhook ingress verifies `X-Gitlab-Token` and routes supported issue, note, and merge request events into Factory rules. Unsupported events, including push events, are acknowledged without changing board state. Issue and merge request reconcilers cover missed terminal events and settle cards the same way the GitHub reconcilers do.
- Sessions that open a merge request through `source_control_create_change_request` are subscribed to it automatically. New notes, closes, and merges wake the subscribed session as the user who created it, with a notification that links to the merge request. `gitlab_subscribe_mr` and `gitlab_unsubscribe_mr` manage subscriptions by hand, `gitlab_get_issue` fetches a routed issue with its discussion, and `GET /web/gitlab/subscriptions` lists a thread's subscriptions for the UI.
- Review board runs use the `factory-gitlab-review` and `factory-gitlab-rereview` skills, check out the merge request head, and re-review when new commits arrive. The UI names merge requests as `!n`, shows merged and closed states, and offers GitLab in onboarding, repository settings, intake routing, and board empty states.

GitLab approvals are exposed as an approval snapshot and are used for submitted `approve` reviews; submitted `comment` reviews become merge request notes. Individual listed approvals and comment reviews can be fetched through synthetic review IDs. GitLab has no equivalent for mutable pending reviews, request-changes reviews, approval dismissal, team review requests, or synchronous rebase-and-merge, so those operations fail explicitly with a not-supported response.

```ts
import { GitLabIntegration } from '@mastra/factory/integrations/gitlab/integration';

const gitlab = new GitLabIntegration({
  baseUrl: 'https://gitlab.example.com',
  accessToken: process.env.GITLAB_ACCESS_TOKEN!,
  accessTokenType: 'group', // Or 'personal'.
  webhookSecret: process.env.GITLAB_WEBHOOK_SECRET,
});
```

Direct mode reads the same values from `GITLAB_ACCESS_TOKEN`, `GITLAB_ACCESS_TOKEN_TYPE`, `GITLAB_BASE_URL`, and `GITLAB_WEBHOOK_SECRET` when constructor options are omitted. Personal and Group Access Tokens are both supported; use `api` and `write_repository` scopes. `GITLAB_BASE_URL` must use HTTPS except for loopback development instances.

When Platform credentials are configured, Factory discovers active GitLab connections for the organization, and `MASTRA_GITLAB_CONNECTION_ID` optionally pins one of them. Requests go through `/v2/connections/{connectionId}/proxy`, and `MASTRA_GITLAB_WEBHOOK_SECRET` verifies webhooks. Explicit direct credentials take precedence. Platform-managed clone and push resolve a fresh repository credential for the selected connection; the connection selector itself is never used as a Git token.
