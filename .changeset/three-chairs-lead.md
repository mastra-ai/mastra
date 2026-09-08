---
'@mastra/libsql': patch
---

Fixed private in-memory Knowledge transactions losing their database connection. Concurrent Knowledge reads now wait for commit or rollback without sharing data between independent clients.
