---
'@mastra/core': patch
---

Fixed an unhandled `abortRunStream is not a function` error when a thread-bound run loses its thread lease, or is aborted from another instance, and its agent has no `abortRunStream` method. The run is still fenced off from further tool calls.
