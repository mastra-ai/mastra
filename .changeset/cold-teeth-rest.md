---
'@mastra/inngest': patch
'@mastra/core': patch
---

Fixed Inngest durable agents returning the original model text after an output processor rewrote or emptied the final answer. The returned text now matches what is saved to memory.
