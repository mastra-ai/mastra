---
'@mastra/pg': patch
---

Fenced workflow saves in Postgres now take one round trip instead of four. A fenced snapshot save, run append, state draft or v1 run delete checks the run's claim and writes in a single statement, so a client that loses its connection mid-save no longer holds a lock that blocks another instance from taking the run over.
