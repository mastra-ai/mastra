---
'@mastra/core': patch
---

Fixed a durable `AgentController` session hanging after a run that waited on a prompt for longer than `MASTRA_SUSPENDED_RUN_TTL_MS` was dropped from memory. The session's next message ran but never finished on screen. The session now stops reading the dropped run's stream, so later runs show and finish as usual, and the dropped prompt can still be answered.
