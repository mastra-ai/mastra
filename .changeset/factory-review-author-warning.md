---
'@mastra/factory': patch
---

Factory reviews now flag a visible misconfiguration warning when the review token is the PR author. Previously GitHub rejected the approve/request-changes submission and the verdict silently fell back to a plain PR comment. The verdict is now published as a submitted comment review with a warning explaining that a separate reviewer token is required for the verdict to count toward branch protection.
