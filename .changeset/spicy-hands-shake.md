---
'@mastra/core': patch
---

Added a `blocking` option to `AgentController.onSessionCreated`. Blocking listeners are awaited before `createSession()` resolves, so hosts can seed session state (for example observational-memory settings loaded from storage) before the caller can start a run. Blocking listeners run sequentially in registration order before fire-and-forget listeners are notified. Listener failures remain isolated and logged; default (non-blocking) listeners keep their fire-and-forget behavior.
