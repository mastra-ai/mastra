---
'@mastra/code-sdk': patch
'@mastra/factory': patch
---

Hosted sessions no longer leak the host process's environment into the system prompt. The dynamic instructions builder drops its `process.cwd()` fallback: a session without a `projectPath` gets no working directory, no host git-branch probe, and loads no instruction files at all (project locations would resolve against the server's cwd and global locations against the server's homedir). Factory additionally blanks the SDK's default project identity seed (`projectPath`/`projectName`/`gitBranch` from the host's own checkout) so chat-only sessions show "(no workspace attached)" instead of the server's repo and branch; repo-backed sessions keep getting their real session workdir pinned by workspace resolution.
