---
'@mastra/core': patch
---

Fixed durable and evented agents returning the original model text after an output processor rewrote the final answer. `text`, `steps` and `generate()` now return what `processOutputResult` produced, including a reply it emptied, so they match what is saved to memory and what a regular Agent returns.
