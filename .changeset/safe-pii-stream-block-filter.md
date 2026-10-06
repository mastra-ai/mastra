---
'@mastra/core': patch
---

Fixed streamed `PIIDetector` output with the `block` and `filter` strategies. When a Social Security number, email address or similar value arrived split across several stream chunks, the first part of it reached the user before the rest was recognized. Now `block` stops the response before any part of the value is shown, and `filter` removes the text up to and including the value while keeping the text after it. Very long email addresses are now also held until they are complete, including with `redact`. As with `redact`, the end of a response may arrive slightly later.
