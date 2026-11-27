---
'@mastra/core': patch
---

Fixed channel runs crashing on a replica with `render.wrapStream is not a function` after a run was restored from a durable snapshot. The channel render context holds live adapters and driver callbacks that JSON cannot carry, so a restored copy was a method-less husk. It is no longer written into the durable request-context snapshot, and every reader that needs a live context now rebuilds it from the run's thread when it finds a husk instead of using it.

A restored run also keeps the reply behaviour of the thread it was started on: how the thread displays the agent's text (posted, hidden, or replaced by tool output) is read back from the thread, so a hidden-text conversation resumed on a replica no longer tells the model to answer in text nobody sees, and a new conversation still gets the link back to its thread.
