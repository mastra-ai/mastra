---
'@mastra/factory': minor
'@mastra/code-sdk': minor
---

Factory session file tools now root at the sandbox `workingDirectory` (the parent directory the repo is cloned into), falling back to the parent of the repo checkout when no working directory is declared. The repo checkout is an ordinary `<repo>/` subdirectory of that root, while AGENTS.md loading, skills, git status, and setup commands stay scoped to the checkout. Generated `.artifacts` live at the working directory, and reads fall back to the repo-local location for existing sessions. `@mastra/code-sdk` gains an optional `workingDirectory` in session state and `registerWorkflowBuilderPrimitives` options; when unset, file tools keep rooting at `projectPath`.
