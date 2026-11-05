---
'@mastra/core': patch
---

Fixed evented workflow steps running twice when the `workflow.step.end` publish failed after the step finished. A dropped connection, a timeout, or a worker dying at that point caused the step to be redelivered and run again, so steps and tools with side effects (sending a message, writing a record, charging a card) could repeat. A finished step's result is now saved before `workflow.step.end` is published, and a redelivery of the same event reuses it instead of running the step again.

This covers successful sequential steps, loop bodies, and foreach iterations such as agent tool calls, on storage that supports workflow step guards (currently only `@mastra/pg`), once the result has been saved. It does not cover a worker crashing between the step returning and the save, a lease being reclaimed while the step is still running, branches of `parallel` and `conditional` blocks, or storage without step guards. Those cases still run at least once.
