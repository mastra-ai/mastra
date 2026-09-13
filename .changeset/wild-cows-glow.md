---
'@mastra/mongodb': patch
---

Fixed concurrent MongoDB Knowledge activation so a second process can wait for schema completion without modifying incomplete or incompatible collections. Interrupted activation still requires an explicit Knowledge-only reset.
