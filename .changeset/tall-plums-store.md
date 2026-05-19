---
'@mastra/libsql': patch
'@mastra/pg': patch
---

Harness storage adapters now persist append-only session event replay records so remote sessions can replay missed events after reconnecting.
