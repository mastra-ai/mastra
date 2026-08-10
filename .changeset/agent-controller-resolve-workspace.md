---
'@mastra/core': patch
'@mastra/code-sdk': patch
---

Stop `AgentController.resolveWorkspace` from pinning one session's workspace onto the controller. It cached the resolved instance on `this.workspace`, which replaced the dynamic workspace factory: every session created afterwards skipped resolution and inherited that instance, so on a multi-session controller one user's workspace became everyone's. It also made `isWorkspaceReady()` flip from `true` to `false` for factory configs. `resolveWorkspace` now returns the workspace the session already resolved at creation, and only falls back to the factory for a session created without one — which also means slash commands read the same instance the session's runs use, instead of a second one materialized from a fresh context.
