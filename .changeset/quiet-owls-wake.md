---
'@mastra/factory': patch
---

Factory now wakes the builder when its own reviewer asks for changes in a `COMMENTED` review. GitHub does not let Factory's app request changes on a pull request it opened, so the reviewer posts its verdict as a comment review starting with `Verdict: request changes`. That review used to be ignored, so the builder never heard about the requested changes. Reviews from people, approvals, notes and verdicts on pull requests Factory did not open still wake nothing.
