---
'@mastra/valkey': patch
---

Avoid repeated full Valkey thread scans during limited controller queries by reading and sorting the resource once before filtering locally.
