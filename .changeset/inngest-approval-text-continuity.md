---
'@mastra/inngest': patch
---

Restore text streamed before tool approval in Inngest agents' resumed output.

`resume()` now waits up to 10 seconds for the suspended iteration's snapshot to record every suspended tool call. If it does not, `resume()` rejects with `Cannot resume run <runId>: the nested iteration snapshot does not contain suspended tool calls <ids>.` and sends no resume event. The run stays suspended, so calling `resume()` again works.
