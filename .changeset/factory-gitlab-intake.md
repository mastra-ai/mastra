---
'@mastra/factory': minor
---

Added GitLab issues as a Factory intake source. Connect a GitLab instance (gitlab.com or self-hosted), pick which projects to sync, and route each one to a Factory. Its open issues then arrive in Intake alongside GitHub and Linear, can be filed onto the board, and get a `factory/gitlab-<iid>` branch when work starts.

**Issues in, pull requests out through GitHub.** GitLab supplies the issues; the code still lives in the Factory's linked GitHub repository, so review happens as a GitHub pull request. This is the same split Linear already runs under — merge requests, GitLab branches, and clone auth are not served from here.

**Credentials are per-organization.** Either an OAuth application (authorization code + PKCE), or a static group or personal access token for a single-team self-hosted setup that would rather not register one. Pass the integration to `MastraFactory` and it registers its own routes:

```ts
import { MastraFactory } from '@mastra/factory';
import { GitLabIntegration } from '@mastra/factory/integrations/gitlab/integration';

const gitlab = new GitLabIntegration({
  // Omit for gitlab.com; set your origin for self-hosted.
  baseUrl: process.env.GITLAB_BASE_URL,
  // An OAuth application...
  clientId: process.env.GITLAB_CLIENT_ID,
  clientSecret: process.env.GITLAB_CLIENT_SECRET,
  // ...or a static token instead.
  accessToken: process.env.GITLAB_ACCESS_TOKEN,
  publicUrl: process.env.MASTRACODE_PUBLIC_URL,
  webhookSecret: process.env.GITLAB_WEBHOOK_SECRET,
});

new MastraFactory({ storage, integrations: [github, gitlab] });
```

Set the OAuth application's redirect URI to exactly `<publicUrl>/web/gitlab/oauth/callback`. Webhooks are optional: point GitLab at `<publicUrl>/web/gitlab/webhook` and give it `webhookSecret` as the secret token, which is compared against the `X-Gitlab-Token` header. The OAuth flow signs `state`, so it also needs a replica-stable state secret, and the server refuses to boot without one.
