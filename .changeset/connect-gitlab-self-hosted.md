---
'@mastra/connect': minor
---

Added support for self-hosted GitLab. Connections on the platform's **GitLab (self-hosted)** integration (`gitlab-self-hosted`), which connect a self-managed instance with an access token and its hostname, now get the same `gitlab_*` tools as gitlab.com connections. Calls go to the instance the connection was made for.

Configure both kinds under `providers.gitlab`. With both a gitlab.com and a self-hosted connection, the agent picks one per call through `gitlab__list_connections` and `connection_name`, or you pin one:

```ts
const connectTools = tools({
  providers: { gitlab: { connectionId: process.env.SELF_HOSTED_GITLAB_CONNECTION_ID } },
});
```

Options keyed by `gitlab-self-hosted` are rejected with a message pointing at `providers.gitlab`.
