---
'@mastra/core': patch
---

Fixed `TokenLimiterProcessor` dropping the current run's tool calls and results between steps.

**What went wrong**

Trimming ran newest-first with no notion of which messages belonged to the run in progress, so a newer or larger message could outrank an assistant tool message and evict it. The next model call then saw neither the tool call nor its result, with nothing to signal anything had been removed. In the reported case the model re-issued the same tool call until it ran out of steps. Removal also strips the message from the response set, which can stop it being saved to memory.

**What changed**

Tool calls and results produced by the run in progress are now kept, and older history gives up its budget first. A call and its result are kept together.

When that tool traffic alone exceeds the budget left after system messages, nothing remains that can safely be removed, so the processor now fails with a non-retryable `TripWire` naming that as the cause. Previously `best-fit` silently re-ran the tool, and `contiguous` stopped but blamed it on "No messages fit within the remaining token budget".

**Behavior change to note**

Protection adds up across steps. A long multi-step run whose combined tool output crosses the limit now stops with that error, rather than quietly dropping its earlier tool traffic.

Applies to `best-fit` and `contiguous`. The `memory-only` mode is unchanged.
