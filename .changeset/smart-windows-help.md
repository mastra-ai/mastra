---
'@mastra/core': minor
---

Session no longer requires a workspace. `AgentController` already allowed running without one, but `Session` threw an error if no workspace was configured or resolved. `getWorkspace()` now returns `Workspace | undefined` to match this.
