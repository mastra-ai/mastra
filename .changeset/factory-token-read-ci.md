---
'@mastra/factory': patch
---

Factory sessions can now read CI results on GitHub. Repository tokens include read-only access to checks, workflow runs and commit statuses, so `gh pr checks` and `gh run view` work instead of failing with "Resource not accessible by integration".
