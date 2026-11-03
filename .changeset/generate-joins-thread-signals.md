---
'@mastra/core': patch
---

Fixed a signal sent to a thread while an `agent.generate()` turn was running starting a second run that could not see that turn. `generate()` now registers its run with the thread like `stream()` does, so `sendSignal`, `sendMessage` and notifications with the default `ifActive: 'deliver'` join the running turn.

As with `stream()`, a thread-bound `generate()` now waits for a run already going on the same thread, so concurrent `generate()` calls on one thread run one after another instead of in parallel. A tool that calls `generate()` or `stream()` on its own thread waits for the run it is part of, so it deadlocks; a tool should use `sendSignal` to send a message to its own thread.
