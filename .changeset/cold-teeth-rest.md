---
'@mastra/inngest': patch
---

Fixed Inngest durable agents returning the original model text after an output processor rewrote or emptied the final reply. `text` and `generate()` now return the final reply as `processOutputResult` left it, as a regular Agent does.
