---
'@mastra/core': patch
---

Fixed Knowledge importers merging two different source items into one node when they share a title. Two imported pages both titled "Dynamic Workflows" now become two nodes. The second one gets a stable, address-based suffix, for example "Dynamic Workflows (ent200)". Previously the second item was silently bound to the first node, and every sync retry then failed at the same item.
