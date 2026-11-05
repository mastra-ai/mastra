---
'@mastra/core': patch
---

Fixed evented workflow steps running twice when the `workflow.step.end` publish failed after the step finished. A dropped connection, a timeout, or a worker dying at that point caused the step to be redelivered and run again, so steps and tools with side effects (sending a message, writing a record, charging a card) could repeat. A finished step's result is now saved before `workflow.step.end` is published — for plain steps, loop bodies, and foreach iterations such as agent tool calls — and a redelivery of the same event reuses it instead of running the step again. This applies to storage that supports workflow step guards (currently `@mastra/pg`). Branches of `parallel` and `conditional` blocks are not covered yet.
