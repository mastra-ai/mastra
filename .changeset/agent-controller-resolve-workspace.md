---
'@mastra/core': patch
---

Fixed `AgentController.resolveWorkspace` handing one session's workspace to every session created after it. On a controller configured with a dynamic workspace factory, the first call cached its result over the factory itself, so later sessions skipped resolution and ran against the first session's workspace instead of their own.

`resolveWorkspace` now returns the workspace a session already resolved at creation, and caches nothing on the controller. Two smaller fixes come with it: `isWorkspaceReady()` no longer flips to `false` for factory configs, and slash commands read the same workspace instance the session's runs use.
