---
'@mastra/core': patch
---

Fixed a durable `AgentController` session hanging after a prompt left unanswered for longer than `MASTRA_SUSPENDED_RUN_TTL_MS`. Later messages now run and finish as usual. The dropped prompt can still be answered.
