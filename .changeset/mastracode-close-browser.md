---
'mastracode': patch
---

Mastra Code now closes its browser when it exits, when it relaunches, and when `/browser` replaces or disables it, so a leftover Chrome no longer keeps the browser profile locked. A replaced browser cannot be relaunched by a tool call that was already running, and if it does not close within 5 seconds its Chrome is killed.
