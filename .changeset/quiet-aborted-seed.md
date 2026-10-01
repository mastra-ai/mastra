---
'@mastra/core': patch
---

Fixed a follow-up message sent right after aborting a run replaying the aborted run. A new thread subscription no longer re-emits the aborted run's lifecycle events (such as a second `agent_start`) while that run is still shutting down.
