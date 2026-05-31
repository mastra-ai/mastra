---
'@mastra/core': patch
---

Fixed BatchPartsProcessor dropping the final stream part when a stopWhen condition stops the agent on a non-text part (such as a tool result). The processor batches text deltas and previously deferred the next non-text part to the following stream iteration; if the loop stopped on that part, it was lost. The buffered text is now flushed and the non-text part is emitted in place, so the final tool result always reaches the stream. The flushed batch is routed through any downstream output processors (e.g. a PII detector running after BatchPartsProcessor) instead of bypassing the rest of the chain. Fixes #17094.
