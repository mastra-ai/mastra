---
'@mastra/core': patch
---

Prevent stale-build instances from claiming scheduled workflow fires. Declarative schedule rows now record a hash of the workflow's serialized step graph, and the scheduler refuses to claim a due fire when the local workflow definition doesn't match the hash on the row — leaving it for an instance running the current build. Fixes scheduled runs intermittently executing an outdated step graph while HTTP runs of the same workflow execute the current one (#19169). Rows without a hash (legacy or imperatively created schedules) and agent schedules are unaffected.
