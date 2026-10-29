---
'@mastra/core': patch
---

Fixed idle AgentController Sessions keeping their last finished run in memory. A Session that stays subscribed to its thread between turns no longer holds the previous run's model output, tools, or input-processor state until the Session is deleted. Fixes #28230.
