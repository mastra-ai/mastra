---
'@mastra/factory': minor
---

Sessions in a multi-repository environment can push and open change requests in any environment repository.

- Every `source_control_*` tool except `source_control_refresh_change_request_checkout` (the GitLab checkout refresh) takes an optional `repository` slug; the default is the repository the session is filed under, and each tool description lists the valid slugs.
- A push sends the local session branch when the repository has one, and the checked-out `HEAD` only where the branch was never created. Pushing a repository with no checkout of its own in the session fails with a clear error.
- Every push and change request is recorded per repository, and a push after a change request keeps the change request fields.
- The `gh pr create` observer and auto-subscribe attribute a pull request to its repository and accept any environment repository. Only a pull request from the session branch is recorded on the session; subscribing to someone else's leaves the record alone.
- `github_subscribe_pr` / `github_unsubscribe_pr` and pull request subscriptions are gated on the Factory, so web user sessions get them too.
- On the platform GitHub provider, `GH_TOKEN` covers every environment repository when they share one installation and number at most ten; otherwise it covers the session repository and the agent is told to use the `source_control_*` tools for the others.
