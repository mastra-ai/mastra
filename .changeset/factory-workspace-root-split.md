---
'@mastra/factory': minor
'@mastra/code-sdk': minor
---

Root a factory session's file tools at the sandbox's `workingDirectory` — the parent directory the repo is cloned into — so the repo checkout is an ordinary `<repo>/` subdirectory and agent paths read `<repo>/packages/...`. When a sandbox does not declare `workingDirectory`, Factory infers the workspace root as the resolved repo directory's parent, preserving the provider-default clone layout without inventing a new path. Repo-scoped machinery is unchanged: AGENTS.md/instruction loading, the untrusted git-ref reader, skills discovery, git status capture, setup commands, and the session file browser stay rooted at the repo checkout. Generated `.artifacts` live at the workspace root; artifact reads, listings, and captures merge the previous repo-local location for existing sessions, with workspace-root files taking precedence.

`@mastra/code-sdk` gains an optional `workspaceRoot` in session state and `registerWorkflowBuilderPrimitives` options. When set and distinct from `projectPath`, file tools and exec root there and the system prompt advertises it (naming the repo subdir); when absent it defaults to `projectPath`, so standalone consumers keep today's behavior.
