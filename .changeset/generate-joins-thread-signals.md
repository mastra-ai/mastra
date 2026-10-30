---
'@mastra/core': patch
---

Fixed a signal sent to a thread while an `agent.generate()` turn was running starting a second run that could not see that turn. `generate()` now registers its run with the thread like `stream()` does, so `sendSignal`, `sendMessage` and notifications with the default `ifActive: 'deliver'` join the running turn.

As with `stream()`, a thread-bound `generate()` now waits for a run already going on the same thread, so concurrent `generate()` calls on one thread run one after another instead of in parallel. A `generate()` or `stream()` made from inside a run on the same thread (for example by a tool or sub-agent sharing the parent's memory) is treated as part of that run and does not wait for it.

A `generate()` that a tool defers until after its run has ended (for example from a `setTimeout`) still runs unregistered, the same as before this fix, so a signal sent to the thread meanwhile starts a new run.
