---
'@mastra/memory': patch
---

Fixed observational memory dropping messages when the Observer model replies with text but no observations, such as a refusal ("I can't help with that"). These replies are now retried the same way as an empty reply, with the same `observation.maxRetries` budget, and `failurePolicy` decides the turn once retries run out. A reply that carries only other Observer sections, such as `<current-task>`, is still accepted.

In resource scope, a thread the Observer leaves out of its reply no longer has its cursor advanced. Its messages are observed in a later cycle.
