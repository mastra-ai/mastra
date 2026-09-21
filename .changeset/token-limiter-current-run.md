---
'@mastra/core': patch
---

Fixed `TokenLimiterProcessor` dropping the current run's tool calls and results between steps.

**What went wrong**

Trimming worked newest-first and did not know which messages belonged to the run in progress, so it could evict a tool call or its result. The model then had no record of the tool it had just run. It could re-issue the same call until it hit `maxSteps`, and the lost message might never be saved to memory.

**What changed**

Tool calls and results from the run in progress are now kept, and a call is always kept together with its result. Older history is trimmed first.

If that tool traffic alone does not fit, the processor now stops with a non-retryable `TripWire` that names the cause, instead of dropping the tool call or reporting "No messages fit within the remaining token budget".

**Behavior change**

Protection adds up across steps. A long run whose combined tool output no longer fits will now stop rather than quietly drop its earlier tool traffic. Raise `limit` if you rely on long multi-step tool runs.
