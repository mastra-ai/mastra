---
'@mastra/core': patch
---

Fixes issue where client tools could not be used with agent.network(). Client tools configured in an agent's defaultOptions will now be available during network execution.

Fixes #12752
