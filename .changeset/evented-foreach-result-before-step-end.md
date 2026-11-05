---
'@mastra/core': patch
---

Fixed evented runs running a tool twice when the `workflow.step.end` publish failed after the tool finished. A dropped connection, a timeout, or a worker dying at that point caused the step to be redelivered and the tool to run again, so tools with side effects (sending a message, writing a record, charging a card) could repeat. A finished tool-call iteration's result is now saved before `workflow.step.end` is published, and a redelivery of the same event reuses it instead of running the tool again. This applies to storage that supports workflow step guards (currently `@mastra/pg`).
