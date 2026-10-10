---
'@mastra/core': patch
---

Fixed workflows exposed to agents as tools running in parallel with other tool calls even when they can suspend. A workflow tool now reports that it can suspend when any of its steps (including nested workflows) declares a `suspendSchema` or `resumeSchema`, so `toolCallConcurrency` runs it one call at a time, the same as a regular tool with a `suspendSchema`. Steps that call `suspend()` should declare a `suspendSchema` or `resumeSchema` so the workflow tool is detected as suspendable.
