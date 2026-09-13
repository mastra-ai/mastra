---
'@mastra/mongodb': patch
---

Fixed MongoDB Knowledge initialization when default indexes are disabled and when multiple instances initialize concurrently, so the schema remains usable after restart.
