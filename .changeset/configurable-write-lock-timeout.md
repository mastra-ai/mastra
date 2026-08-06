---
'@mastra/core': patch
---

Expose `writeLockTimeoutMs` on `WorkspaceToolsConfig` so the per-file write-lock timeout is configurable. `createWorkspaceTools` constructed the shared `InMemoryFileWriteLock` with no options, leaving its 30s default unreachable from user code. That default is right for a local filesystem but wrong for a remote or cold-starting sandbox filesystem, where the first write after a container comes up can legitimately take minutes — the lock rejected it with `write-lock timeout` for a reason unrelated to the write. Leaving the option unset preserves the 30s default, so existing workspaces are unaffected.
