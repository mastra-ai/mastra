---
'@mastra/core': patch
---

What changed:

Support for sequential tool execution was added. Tool call concurrency is now set conditionally, defaulting to 1 when sequential execution is needed (to avoid race conditions that interfere with human-in-the-loop approval during the workflow) rather than the default of 10 when concurrency is acceptable.

How it was changed:

A `sequentialExecutionRequired` constant was set to a boolean depending on whether any of the tools involved in a returned agentic execution workflow would require approval. If any tool has a 'suspendSchema' property (used for conditionally suspending execution and waiting for human input), or if they have their `requireApproval` property set to `true`, then the concurrency property used in the toolCallStep is set to 1, causing sequential execution. The old default of 10 remains otherwise.
