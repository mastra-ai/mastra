---
'@mastra/libsql': patch
---

Fixed intermittent "no such table" and SQLITE_BUSY errors with local LibSQL databases under concurrent load. Transactions on file and in-memory databases no longer drop tables or lose connection settings, so concurrent agent, workflow, and memory operations stay reliable.

This works around two upstream `@libsql/client` issues where opening a transaction on a local database detaches the connection: [#229](https://github.com/tursodatabase/libsql-client-ts/issues/229) (in-memory database discarded) and [#288](https://github.com/tursodatabase/libsql-client-ts/issues/288) (busy_timeout dropped on file databases).
