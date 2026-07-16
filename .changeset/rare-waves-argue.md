---
'@mastra/core': patch
---

Fixed trace-derived dataset items with circular values so they remain saveable, and made direct dataset writes reject invalid circular payloads before storage.
