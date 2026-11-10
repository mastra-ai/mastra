---
'@mastra/core': patch
---

Fixed durable and evented agents returning the original model text after an output processor rewrote the final reply. `text` and `generate()` now return the final reply as `processOutputResult` left it, including a reply it emptied, as a regular Agent does. Earlier step texts in `steps` and the returned response messages are unchanged.
