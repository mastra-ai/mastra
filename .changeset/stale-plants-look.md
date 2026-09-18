---
'@mastra/github-signals': patch
---

Fixed PR syncing failing with a 401 when an expired GitHub token was exported in the environment. Each sync now resolves a fresh credential from the `gh` CLI, so a stale `GITHUB_TOKEN` or `GH_TOKEN` is replaced instead of being sent to GitHub. Author permission checks use the same credential.
