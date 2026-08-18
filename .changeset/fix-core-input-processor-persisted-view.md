---
'@mastra/core': patch
---

Input processors no longer change what gets saved to memory. Previously, with memory enabled, a processor that rewrites messages for the model (such as `ToolCallFilter`) could also alter the remembered messages in storage, dropping stored tool-invocation data. Remembered messages are now kept as they were saved, while the model still sees the processor's filtered view.
