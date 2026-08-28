---
'@mastra/code-sdk': patch
---

**SandboxFilesystem advertises its workdir as the default command cwd.** It implements the new `WorkspaceFilesystem.defaultCwd()` hook, so `execute_command` calls without an explicit `cwd` run in the session's repository checkout instead of the provider's home directory. Resolving a lazy workdir may start the VM, which the caller was about to do anyway.
