---
'@mastra/core': patch
---

Fixed `observe()` replay of a durable agent run showing the same step twice after another process took the run over. When an execution lost its claim mid-step, readers replaying from the start received both that execution's unfinished output and the recovering execution's re-run of the same step. Replay now omits the superseded output and keeps every checkpointed step. When the model step was already checkpointed and only some tool calls were unfinished, only those tool calls' superseded output is dropped; tool calls that finished stay.
