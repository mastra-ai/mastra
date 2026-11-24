---
'mastra': patch
---

Studio's Knowledge page refreshes one read at a time while an agent writes. Before, every burst of writes started a new graph read even when the last one was still running, which could pile up reads on large Knowledge instances.
