---
'@mastra/factory': patch
---

Added a **Recreate sandbox** action for Factory sessions. When a session's sandbox gets stuck, the session owner or an organization admin can destroy it from the session's workspace panel. Any running agent is stopped, and the next message boots a fresh sandbox from the template. The conversation and the session itself are kept. Private sessions can only be recreated by their owner. The action isn't offered on the local sandbox provider.
