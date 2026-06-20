---
'@mastra/core': patch
---

Fixed silent loss of conversation history when saving messages to storage failed.

Previously, if a storage write failed during an agent run (transient connection drop, timeout, constraint violation, pool exhaustion), the unsaved messages were already drained from the message list and the error was swallowed. The agent run completed as if everything was persisted, leaving a permanent hole in the thread history that was never retried.

Now a failed save keeps the messages queued so the next flush retries them, and the error is propagated to the caller of `flushMessages()` so the agent run can surface or handle it. A single failure no longer stalls later saves for the same thread.

Also fixed a related issue where rapidly calling `batchMessages()` within the debounce window left the superseded call's promise hanging forever. Every promise now settles when the batched save completes.
