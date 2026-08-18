---
'@mastra/pg': patch
---

Stop a dropped Postgres connection from killing the process while a client is checked out.

`PgFactoryStorage` attached an `error` listener to the pool, but pg only routes pool-level errors for *idle* clients — it hands ownership of a client to the borrower for the duration of a checkout. A backend restart or network blip that landed on a client mid-transaction therefore reached an emitter with nothing listening, and Node escalated it to an uncaughtException that took the whole server down (`Connection terminated unexpectedly` at `pg/lib/client.js`), even though the idle siblings were logged and discarded cleanly.

Pools created by `PgFactoryStorage` now attach a listener once per physical connection as it is established, so a client stays covered while idle *and* while borrowed. The pool still discards the failed connection and reconnects on the next checkout; the failure is now logged instead of fatal. Caller-supplied pools are left untouched, as before.
