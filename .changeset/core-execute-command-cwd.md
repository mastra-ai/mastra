---
'@mastra/core': minor
---

**Workspace commands now run from the workspace root by default.** The agent's prompt advertises the filesystem root as its working directory, but `execute_command` without a `cwd` ran at the sandbox provider's default (usually `$HOME`) — so a bare `pnpm install` landed outside the repository while file tools read inside it. Filesystems that live inside the workspace's sandbox can now advertise the root via a new optional `WorkspaceFilesystem.defaultCwd()`, and `execute_command` uses it when the caller omits `cwd`. An explicit `cwd` always wins, and filesystems that don't implement the hook keep the previous behavior.
