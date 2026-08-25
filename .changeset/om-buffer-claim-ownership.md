---
'@mastra/core': patch
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
'@mastra/convex': patch
'@mastra/oracledb': patch
---

Observational Memory buffering is now safe when independent Mastra processes share one storage backend: each buffering cycle holds an exclusive, expiring ownership claim, so one process can no longer clear or overwrite another's in-flight work, and a crashed process's claim recovers automatically. All bundled stores (LibSQL, PostgreSQL, MySQL, MongoDB, Convex, OracleDB) support claims out of the box; custom storage adapters keep working unchanged on the previous single-process buffering behavior until they opt in:

```ts
class MyMemoryStorage extends MemoryStorage {
  override readonly supportsObservationBufferClaims = true;
  // then implement the observation-buffer-claim methods — see the
  // MemoryStorage base class in @mastra/core/storage for the contract
}
```

No migration needed: existing records remain readable without backfill.
