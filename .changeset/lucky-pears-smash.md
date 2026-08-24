---
'@mastra/inngest': patch
---

Fix durable agent dropping the per-call `actor` signal, and centralize durable trigger/resume event construction.

`createInngestAgent()` accepted an `actor` option on `stream()` but never forwarded it into the workflow trigger event, so authorization checks downstream saw no actor. `resume()` did not accept an `actor` at all. Both now match `InngestRun`: `actor` is supplied per call and is never read back from the persisted snapshot.

The trigger and resume event payloads were previously built independently in `run.ts` and in the durable agent wrapper, which is how the two paths drifted apart. Both now build their events through shared helpers so a new per-call signal cannot be added to one path alone.
