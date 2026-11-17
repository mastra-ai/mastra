---
'@mastra/core': patch
'@mastra/factory': patch
---

Coding agents now subscribe their thread to an existing pull request or merge request when they start working on it, such as reviewing it, fixing merge conflicts, addressing review comments, fixing CI, or pushing to its branch. The thread then gets the merge and close notices for that PR, not only for PRs the agent created itself.
