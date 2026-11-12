---
'@mastra/redis': patch
---

Avoid repeated full Redis thread scans during limited controller queries by reading and sorting the resource once before filtering locally.
