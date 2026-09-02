---
'@mastra/factory': minor
'@mastra/code-sdk': minor
---

Factory session file tools, command execution, the session file browser, and generated `.artifacts` all root at the sandbox `workingDirectory` (the parent directory the repo is cloned into), falling back to the parent of the repo checkout when no working directory is declared. The repo checkout is an ordinary `<repo>/` subdirectory of that root, and browser paths address it that way (`<repo>/src/index.ts`), while AGENTS.md loading, skills, git status, and setup commands stay scoped to the checkout. `@mastra/code-sdk` gains an optional `workingDirectory` in session state and `registerWorkflowBuilderPrimitives` options; when unset, file tools keep rooting at `projectPath`.
