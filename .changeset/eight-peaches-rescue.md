---
'@mastra/core': patch
---

Fixed BatchPartsProcessor dropping the final stream part when a stopWhen condition stops the agent on a non-text part (such as a tool result). The processor batches text deltas and previously deferred the next non-text part to the following stream iteration; if the loop stopped on that part, it was lost. BatchPartsProcessor now returns the flushed batch and hands the non-text part back to the output processor runner, which re-drives it through the full output processor chain. As a result the final tool result always reaches the stream, and the flushed batch still passes through any downstream output processors (e.g. a moderation or PII processor configured after BatchPartsProcessor) instead of bypassing them. Fixes #17094.
