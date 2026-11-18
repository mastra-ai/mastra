---
'@mastra/core': patch
---

Blocked messages no longer print an error with a stack trace. When an input or output processor calls `abort()`, the workflow step that ran it used to log `Error executing step …: TripWire: …` at ERROR level with the full stack, even though a guardrail blocking a message is expected behavior. Tripwires are now logged at debug level with the step id, processor id and reason. The run still returns `result.tripwire` and the trace still records the step as blocked by a guardrail. Genuine step errors still log at ERROR with their stack.
