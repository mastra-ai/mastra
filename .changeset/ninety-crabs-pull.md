---
'@mastra/factory': minor
---

Sessions in a multi-repository environment can push and open change requests in any environment repository.

- `source_control_push_branch` and `source_control_create_change_request` take an optional `repository` slug; the default is the repository the session is filed under, and the tool description lists the valid slugs.
- Every push and change request is recorded per repository, and a push after a change request keeps the change request fields.
- The `gh pr create` observer and auto-subscribe attribute a pull request to its repository and accept any environment repository.
- `github_subscribe_pr` / `github_unsubscribe_pr` and pull request subscriptions are gated on the Factory, so web user sessions get them too.
- On the platform GitHub provider, `GH_TOKEN` covers every environment repository when they share one installation and number at most ten; otherwise it covers the session repository and the agent is told to use the `source_control_*` tools for the others.
