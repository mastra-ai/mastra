---
'@mastra/core': patch
---

Fixed answering a tool suspension from another thread on durable and evented agents. Calling `session.respondToToolSuspension()` with the address of a suspension from a thread the session is no longer on now returns once the resumed run ends. Before, durable agents never returned, and evented agents threw "Cannot uniquely identify the suspended run's owning agent".
