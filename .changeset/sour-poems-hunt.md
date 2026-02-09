---
'@mastra/core': patch
---

fix: support clientTools in agent.network() via defaultOptions

Fixes issue where client tools could not be used with agent.network(). Client tools configured in an agent's defaultOptions and will now be available during network execution.

Fixes #12752
