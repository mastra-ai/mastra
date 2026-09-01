---
'@mastra/factory': minor
'@mastra/code-sdk': minor
---

Root a factory session's file tools at the sandbox's `workingDirectory` — the parent directory the repo is cloned into — so the repo checkout is an ordinary `<repo>/` subdirectory and agent paths read `<repo>/packages/...`. Sandboxes with no declared `workingDirectory` keep the previous layout (the root degrades to the repo dir's parent). Repo-scoped machinery is unchanged: AGENTS.md/instruction loading, the untrusted git-ref reader, skills discovery, git status capture, setup commands, and the session file browser stay rooted at the repo checkout.

`@mastra/code-sdk` gains an optional `workspaceRoot` in session state and `registerWorkflowBuilderPrimitives` options. When set and distinct from `projectPath`, file tools and exec root there and the system prompt advertises it (naming the repo subdir); when absent it defaults to `projectPath`, so standalone consumers keep today's behavior.
