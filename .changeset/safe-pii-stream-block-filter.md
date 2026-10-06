---
'@mastra/core': patch
---

Fixed streamed `PIIDetector` `block` and `filter` strategies so they no longer send the start of an SSN, email or other regex-detected value before the rest of it arrives in a later chunk. `block` now stops the stream before any part of the value is sent. `filter` drops the held text up to the end of the value and keeps the text after it. Like `redact`, these strategies may briefly delay trailing text until a later text or non-text chunk.
