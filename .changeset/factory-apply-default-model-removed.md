---
'mastra': patch
---

Removed `mastra api factory project apply-default-model`. Factory sessions on a model pack now follow edits to that pack on their next request, so there is nothing to apply to running sessions.
