---
'@mastra/core': patch
'mastracode': patch
---

Moved MastraCode model catalog and gateway-backed model resolution out of the core harness and into a class-backed MastraCode gateway, with model IDs resolving directly to gateway-created provider instances.
