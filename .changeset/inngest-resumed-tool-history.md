---
'@mastra/inngest': patch
---

Fixed resumed Inngest agent output so it includes tool calls made before suspension. Earlier stream events do not repeat, and completed tools do not run again.

`resume()` now waits up to 10 seconds for the stored run state to include the suspended tool calls. If they are still missing, `resume()` rejects with `Cannot resume run <runId>: ...` without sending a resume event. The run stays suspended, so you can call `resume()` again.
