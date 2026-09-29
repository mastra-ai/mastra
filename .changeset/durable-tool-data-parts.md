---
'@mastra/core': patch
---

Fixed `createDurableAgent` dropping non-transient `data-*` parts that tools write with `context.writer.custom()`. These parts are now saved to memory, just like with a regular `Agent`. Transient parts still only go to the stream.
