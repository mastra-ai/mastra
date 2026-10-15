---
'@mastra/core': patch
---

Fixed `stream()` reporting of output processor rejections. When `processOutputResult` calls `abort()`, the plain `Agent`'s `fullStream` now ends with a `tripwire` chunk instead of a `finish` chunk with reason `stop`, and durable agent stream results now expose `tripwire` and `finishReason`, matching `generate()`.
