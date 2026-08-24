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

Fixed Observational Memory buffering so independent Mastra processes sharing one storage backend can no longer clear or overwrite each other's active buffering work. Each observation-buffer cycle now acquires an atomic storage-owned claim: a unique cycle token with a bounded lease that is renewed while the model call runs. Buffered output, lease renewal, and release are all owner-conditioned. A crashed owner's claim expires and can be taken over atomically. A late completion from a replaced owner is fenced out instead of overwriting the successor's state. Status rendering now reports `running` only for a valid unexpired claim (or a bounded legacy marker), never for a bare boolean left behind by a dead process.

**Notes for custom store implementers:** `ObservationalMemoryRecord` gains four nullable claim fields (`observationBufferClaimToken`, `observationBufferClaimAcquiredAt`, `observationBufferClaimRenewedAt`, `observationBufferClaimExpiresAt`). The memory storage domain gains five claim operations, each with a throwing default:

- `acquireObservationBufferClaim`
- `renewObservationBufferClaim`
- `releaseObservationBufferClaim`
- `commitBufferedObservations`
- `getObservationBufferClaimStatus`

`setBufferingObservationFlag` is deprecated to a migration/test-only compatibility helper. Existing rows remain readable without backfill; a legacy `isBufferingObservation=true` row without claim metadata is respected for a bounded grace window and then becomes atomically claimable.

**Limitations:** this does not provide exactly-once model execution. Duplicate model work can still occur around lease expiry; the guarantee is owner-safe commit/release. During a rolling upgrade, binaries older than this change can still perform unconditional flag writes because they do not know the claim token, so fully safe upgrades require quiescing old writers first. A healthy but paused worker that exceeds its lease without renewing can lose ownership and have its output discarded.
