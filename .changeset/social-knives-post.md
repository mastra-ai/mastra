---
'@mastra/libsql': patch
---

Fixed intermittent "no such table" and SQLITE_BUSY errors with local LibSQL databases under concurrent load. Transactions on file and in-memory databases no longer drop tables or lose connection settings, so concurrent agent, workflow, and memory operations stay reliable.

This also mitigates two upstream `@libsql/client` issues: [#229](https://github.com/tursodatabase/libsql-client-ts/issues/229) (in-memory databases could be reset after transaction churn) and [#288](https://github.com/tursodatabase/libsql-client-ts/issues/288) (file databases could lose `busy_timeout` behavior after transaction churn).
