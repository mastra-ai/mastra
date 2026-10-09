---
'@mastra/core': patch
---

Fixed a guardrail leak where a reply rejected by an output processor's `processOutputStep` was still saved to the memory thread and returned as `result.text` when the run ended on the tripwire (after `maxProcessorRetries` ran out, or on an abort without retry). The rejected reply is now dropped; the user message and any earlier accepted steps, such as tool calls and results, are still kept. Fixes #26048.
