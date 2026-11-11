---
'@mastra/core': patch
---

The coding agent now ends pull request descriptions with one `Fixes <ID>` line for each Linear issue it worked on, such as `Fixes ENG-123`, so the GitHub and Linear sync links the PR and closes the issues. GitHub issues get `Fixes #<number>`, and an issue the PR only partly addresses gets `Ref <ID>`.
