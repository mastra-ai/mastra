---
"@mastra/core": patch
---

Fixed `timeTravel()` for failed `foreach()` runs so completed iterations are preserved and only failed iterations are retried.
