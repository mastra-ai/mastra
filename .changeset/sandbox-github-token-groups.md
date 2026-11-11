---
'@mastra/factory': patch
---

Sandboxes in a Factory with more than ten repositories can now reach all of them with `git` and `gh`. GitHub tokens hold at most ten repositories, so the sandbox now gets one token per group of ten (`GH_TOKEN`, `GH_TOKEN_2`, …). Each checkout's git credential helper uses the token that covers it, `github_refresh_token` refreshes every group, and the environment note tells the agent which variable to use for `gh` in each repository. Before, a Factory over ten repositories fell back to a token for the session repository only.
