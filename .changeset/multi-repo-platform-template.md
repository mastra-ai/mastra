---
'@mastra/platform-workspace': minor
---

Add a multi-repository form to `createRepoTemplate`: pass `repos: [{ getRepositoryAccess, setupCommand? }]` to clone several repositories into one sandbox template, each with its own credential and setup commands, plus `workspaceSetupCommand` (run once at the working directory) and `continueOnSetupFailure` (record a failing per-repository setup in `.mastra-sandbox/setup-failed` instead of failing the build). Per-repository setup markers land at `.mastra-sandbox/repos/<repo>` and a workspace marker at `.mastra-sandbox/workspace-setup`. Public repositories are built before private ones so their layers can be cached across credential rotation once the platform positions ephemeral build envs at the call site.
