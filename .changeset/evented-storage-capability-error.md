---
'@mastra/core': patch
---

Durable agents no longer fail to start when their storage cannot apply concurrent workflow updates atomically.

The evented execution engine advances a run from concurrent workers, so it refuses to start on a storage adapter whose workflows domain does not support atomic concurrent updates. Durable agents now degrade to the default in-process engine with a warning in that case, the same way an agent with no Mastra host already did, rather than throwing on the first `.stream()` call. This keeps agents on adapters such as `@mastra/redis` and `@mastra/valkey` working, at the cost of evented execution — the warning names the adapter and the capability it is missing.

A workflow that opts into the evented engine directly, by declaring a `schedule`, still gets an error, because there is no other engine it could have meant. That error now names the storage adapter it came from, names the missing capability, and lists the adapters that support it; it previously only suggested removing the `schedule` field.
