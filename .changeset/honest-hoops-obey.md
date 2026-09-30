---
'@mastra/factory': patch
---

Slack sessions backed by a GitHub repository can now reload the GitHub CLI credential in their running sandbox with `github_refresh_token`, so a `gh` command that failed authentication can be retried.
