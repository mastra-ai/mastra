---
'@mastra/core': patch
---

Fixed an issue where a temporary Redis pause could cancel an evented agent run even though its workflow storage was still available.
