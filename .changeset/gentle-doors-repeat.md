---
'@mastra/inngest': patch
---

Fix durable agent resume targeting and dispatch error handling on Inngest.

Resume labels (the `toolCallId` a suspended tool call registers) were dropped when a suspension crossed a nested workflow boundary, so `createInngestAgent().resume()` had nothing to target with. It also addressed only the outer step, leaving the engine to guess which suspension inside that step to resume — a guess that fails with `Multiple suspended steps found` when several are parked.

Nested suspensions now carry their resume labels up to the parent snapshot, `resume()` accepts a `toolCallId` naming which suspended tool call to resume, and the resume event now addresses the full path down to the suspended leaf instead of just the outer step. If the supplied `toolCallId` is unknown, or if it is omitted while more than one suspension is parked, `resume()` throws immediately and lists the available `toolCallId`s instead of silently resuming the wrong one.

`resume()` also awaits acknowledgement of the resume event dispatch before returning, so a failed send rejects the call instead of only surfacing later as a terminal stream error.
