---
'@mastra/factory': patch
---

Fixed Factory sessions that stopped responding after a server restart. A GitHub event on the pull request now revives the session instead of failing with `Factory session … is not available to the current user`, so the thread picks up where it left off instead of sitting on a spinner.
