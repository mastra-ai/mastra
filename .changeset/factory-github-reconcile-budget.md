---
'@mastra/factory': patch
---

Reduced the GitHub integration's REST request volume. Collaborator permission lookups are cached for 30 minutes per repo and login, and the PR/issue reconcile sweeps default to hourly instead of every 5 minutes; event polling and webhooks remain the primary sync. Override the interval with `MASTRACODE_PLATFORM_GITHUB_RECONCILE_INTERVAL_MS` (platform) or `MASTRACODE_GITHUB_RECONCILE_INTERVAL_MS` (direct), or the `_PR_` / `_ISSUE_` variants.
