---
"@mastra/core": patch
---

Fixed DurableAgent terminal cleanup so it also clears `workflow.events.v2.<runId>`, preventing orphaned no-TTL counter keys on persistent caches (#20786).
