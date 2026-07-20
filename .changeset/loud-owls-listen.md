---
'@mastra/core': patch
---

Exempt memory-sourced messages from the resourceId guard in inputToMastraDBMessage, matching the existing threadId exemption. Memory messages can carry a system resourceId (e.g. observational-memory continuation messages arrive with the observer's resourceId), and the mismatch previously threw inside input processing and hard-aborted the turn.
