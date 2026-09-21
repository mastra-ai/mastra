---
'@mastra/core': patch
---

Stop `TokenLimiterProcessor` from dropping the current run's tool calls and results between steps.

`processInputStep` trimmed newest-first with no notion of which messages belonged to the run in progress, so a newer or larger message could outrank an assistant tool message and evict it. The next model call then saw neither the tool call nor its result. With no signal anything had been removed, the model would re-issue the same tool call until `maxSteps`, and the message was also stripped from the response set, which can stop it being persisted at all, depending on whether the save queue had already drained it.

The processor now identifies the tool traffic the current run has produced (the live output set unioned with the persisted response set, so the protection survives the save queue draining mid-run, grouped so a tool call and its result are kept together) and never trims it. Older history gives up its budget first. When that traffic alone exceeds the budget there is nothing left that may safely be removed, so the processor now throws a non-retryable `TripWire` naming that as the cause, mirroring the existing guard for system messages that alone exceed the limit. Previously `best-fit` burned every remaining step re-running the tool, and `contiguous` aborted but reported it as "No messages fit within the remaining token budget".

Note that protection is cumulative within a run: a long multi-step run whose combined tool output crosses the limit now trips rather than quietly dropping its earlier tool traffic.
