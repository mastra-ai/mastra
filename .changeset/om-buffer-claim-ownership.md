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

Observational Memory buffering is now safe when independent Mastra processes share one storage backend. On claim-capable storage adapters, each buffering cycle holds an exclusive, expiring ownership claim, so one process can no longer clear or overwrite another process's in-flight buffering work, and a crashed process's claim recovers automatically. The bundled LibSQL, PostgreSQL, MySQL, MongoDB, Convex, and OracleDB stores are all claim-capable.

Storage adapters that predate this change (including custom ones) keep working: `@mastra/memory` detects that the adapter does not declare buffer-claim support and falls back to the previous single-process buffering behavior instead of failing. The fallback preserves the pre-existing behavior, including its pre-existing limitation: it is only safe when a single process writes to the record at a time.

**For custom store implementers** (signatures elided for brevity — see the `MemoryStorage` base class in `@mastra/core/storage` for the full contract): to opt into cross-process-safe buffering, implement the five observation-buffer-claim methods on your memory storage domain and declare the capability:

```ts
class MyMemoryStorage extends MemoryStorage {
  override readonly supportsObservationBufferClaims = true;

  async acquireObservationBufferClaim(/* ... */) {/* ... */}
  async renewObservationBufferClaim(/* ... */) {/* ... */}
  async releaseObservationBufferClaim(/* ... */) {/* ... */}
  async commitBufferedObservations(/* ... */) {/* ... */}
  async getObservationBufferClaimStatus(/* ... */) {/* ... */}
}
```

Until you do, the flag defaults to `false` and the legacy buffering path is used. `ObservationalMemoryRecord` gains four nullable claim fields; existing rows remain readable without any backfill or migration.

**Limitations:** this does not provide exactly-once model execution — duplicate model work can still occur around claim expiry; the guarantee is that only the current owner can commit or release. The legacy fallback path is not cross-process safe. During a rolling upgrade, binaries older than this change can still perform unconditional writes, so fully safe upgrades require quiescing old writers first.
