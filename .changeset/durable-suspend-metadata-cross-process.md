---
'@mastra/core': patch
---

Fixed durable agents losing a pending approval on page refresh when the agentic loop runs on a separate worker process (e.g. the `@mastra/inngest` `connect()` worker). The suspended tool's metadata is now persisted to the assistant message, so a reloading client can re-render the approval instead of showing none while the run sits parked.

**Why it happened:** the durable tool-call step took its `SaveQueueManager` from the run registry, which is an in-memory, process-local cache populated only in the process that called `stream()`. On a remote worker it was missing, so the message flush before suspension silently did nothing and `suspendedTools` never reached storage.
