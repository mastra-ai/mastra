---
'@mastra/factory': patch
---

Factory reviews no longer publish a verdict on a pull request head that has already moved. Before posting, the review and re-review skills check that the PR head still matches the commit they verified. If a push landed mid-review, they review the new commits before publishing.
