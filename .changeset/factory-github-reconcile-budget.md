---
'@mastra/factory': patch
---

Fixed the GitHub integration exhausting the installation's REST rate limit: collaborator permission lookups are now cached for 30 minutes per repo and login (the reconcile sweep re-checked every open card's author on every pass), and the PR/issue reconcile sweeps default to hourly instead of every 5 minutes since event polling and webhooks are the primary sync. Override the interval with `MASTRACODE_PLATFORM_GITHUB_RECONCILE_INTERVAL_MS` (platform) or `MASTRACODE_GITHUB_RECONCILE_INTERVAL_MS` (direct), or the `_PR_` / `_ISSUE_` variants.
