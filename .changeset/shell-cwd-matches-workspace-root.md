---
'@mastra/core': patch
'@mastra/code-sdk': patch
---

`execute_command` now resolves relative paths against the workspace directory, not the sandbox's own default working directory.

On a SandboxFilesystem the file tools resolve paths against the workspace root, but shell commands started wherever the sandbox was rooted, so a file written by a relative shell path (`cat > .artifacts/plans/x.md`) landed in a different directory than the same path passed to `write_file` — in a Factory session the plan card then could not load the plan the shell had written.

`@mastra/core` adds an optional `WorkspaceFilesystem.getCommandCwd()` that reports the sandbox directory shell commands should default to, and `execute_command` uses it for both foreground and background commands: an omitted `cwd` now starts in that directory, and a relative `cwd` is resolved against it. Filesystems that do not report a root (host or in-memory filesystems, CompositeFilesystem mounts, third-party implementations) keep the previous behaviour exactly, and an explicit absolute `cwd` still wins.
