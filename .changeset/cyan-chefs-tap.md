---
'@mastra/factory': minor
---

Added GitLab as a full Factory provider, not just an intake source.

A GitLab project can now drive the whole Factory loop: issues arrive as work items, merge requests arrive as review cards, and the agent works them with tools that speak GitLab.

**What this enables**

- GitLab issues and merge requests open, update, and close Factory cards through a webhook, so a card tracks its issue without polling
- Merge requests are served through the same version-control capability as GitHub pull requests, so a review session checks out the merge request's own code instead of the base branch
- The triage, review, and completion skills carry a GitLab branch and post their handoffs as GitLab notes
- A deployment whose codebase lives on GitLab can open sessions at all: the integration that owns source control is now resolved by capability rather than assumed to be GitHub

**Breaking**

A GitLab webhook secret is now required. Configuring a webhook without one previously accepted every unauthenticated delivery; that route now dispatches real work, so the integration refuses to start without a secret:

```ts
new GitLabIntegration({
  clientId: process.env.GITLAB_CLIENT_ID,
  clientSecret: process.env.GITLAB_CLIENT_SECRET,
  // Now required alongside a configured webhook.
  webhookSecret: process.env.GITLAB_WEBHOOK_SECRET,
});
```

Deployments that register both GitHub and GitLab are unaffected: GitHub keeps ownership of source control.
