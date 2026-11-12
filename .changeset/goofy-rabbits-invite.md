---
'@mastra/core': patch
---

Durable and evented agents now save the same turn as other agents when a total timeout ends the run.

- Save the text a step was streaming when it was cut off as its own message, after the step processors run over it.
- Keep the data parts that processors write.
- Keep the result of a tool call that finished before the deadline.
- Apply tool transcript transforms to results saved at the deadline, so redacted values stay redacted.
- Save the `toModelOutput` output of tool results that settle just after the deadline, so the next turn sends the model the mapped output.
- Save the turn of a recovered run too.
- Show the output processors of the deadline save in the run's trace.
- Save nothing for read-only runs or for callers without write access to the thread.
