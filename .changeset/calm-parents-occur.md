---
'@mastra/pg': patch
---

A fenced snapshot save, run append without step guards, state draft or v1 run delete in Postgres now checks the run's claim and writes in one statement instead of four round trips. A client cut during one of these writes no longer holds a lock that blocks another instance from taking the run over. Other fenced workflow writes are unchanged.
