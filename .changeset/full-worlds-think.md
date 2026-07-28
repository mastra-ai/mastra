---
'@mastra/pg': patch
---

Fixed a crash where the server process exited when an idle Postgres connection in the PgFactoryStorage pool dropped (for example after a network change or database restart). The pool now discards the broken connection, logs a warning, and reconnects on the next query.
