---
'@mastra/factory': patch
'@mastra/core': patch
'@mastra/pg': patch
---

The factory-review skill now publishes its verdict on the pull request itself (gh pr review --approve / --request-changes with the full handoff body, falling back to a PR comment when GitHub rejects the review) instead of only posting the verdict in the Factory thread
