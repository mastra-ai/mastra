---
'@mastra/factory': patch
---

Factory reviews now flag a visible misconfiguration warning when the review token is the PR author. Previously GitHub rejected the approve/request-changes submission and the verdict silently fell back to a plain PR comment. The verdict is still published as a PR comment (so the repair loop keeps working), with a warning placed after the verdict line explaining that a separate reviewer token is required for the verdict to count toward branch protection.
