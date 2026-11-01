# Local recovery and data lifecycle

Use the protected local API and console for current state. `GET /api/operations` reports the last offline operation, retention cleanup state and pending image resource records. The Settings view shows the same recovery information. The owned lab also persists its exact fixture, network and image intents in private `data/owned-lab-runtime.json`. A dead runner is visible as `OWNED_LAB_PROCESS_INTERRUPTED`; relaunching `npm run lab` reconciles interrupted scans before removing only the previous receipt's resources. Failed cleanup preserves `DEBT` and the receipt. Preserve it until recovery succeeds. A live or ambiguous prior PID prevents a second lab instance.

Counts of image records are bookkeeping counts; they do not imply that all images are unused. Existing consumers keep their images.

## Retention and missing credentials

Select `retention: { evidenceDays, approvedBy }` explicitly on each policy before admitting a non-lab target. There is no inferred retention period. `GET /api/retention` reports recent cleanup receipts and whether discovery expiry remains pending. `POST /api/retention/cleanup` accepts `{}` with the normal session, Origin and CSRF headers. Each call removes at most 128 discovery evidence records and expires at most 128 dependent verification proofs. The minute worker and subsequent admissions retry the same bounded cleanup.

A storage failure records `DEBT` and returns `RETENTION_CLEANUP_FAILED`; it does not permanently disable discovery. Repair storage access, retry the cleanup, and inspect its committed receipt. Failed cleanup never returns expired observations as available evidence. Source expiry removes dependent proof observations and evidence IDs, marks findings and job evidence unavailable, and preserves the dated outcome as history. The Findings and Evaluations views show evidence availability explicitly. A historical confirmation without retained proof is not a current reproducible confirmation.

Keep `SCANNER_ENCRYPTION_KEY` private and available across restarts. Missing or incorrect keys return `CREDENTIAL_UNAVAILABLE` and require deliberate credential re-registration. There is no plaintext recovery or automatic export. Replace the affected profile using its current revision and a newly supplied credential, then check the identity again. Re-registration increments profile and credential revisions; an older approval or scan binding cannot authorize the new identity.

## Stop and drain

Stop `npm run dev` with Ctrl+C before offline maintenance. Shutdown stops new work and awaits active cancellation/owned cleanup. It can leave queued investigations or approvals, which are not resumed by an offline backup command.

Run `npm run operate -- drain` after the listener has stopped. Drain reconciles only recorded owned resources, cancels bounded batches of pending jobs/planning, advances fences and expires related approvals. Repeat when it reports incomplete work. `DEBT` remains visible if owned cleanup fails. A live or ambiguous instance PID rejects offline maintenance as `INSTANCE_ACTIVE`.

The cleanup preserves unrelated containers, networks and volumes. A shared image and its deletion receipt survive while any consumer exists. After its last consumer stops, run drain again to finish image cleanup. Image cleanup rotates through a bounded persisted cursor. When Docker uses the classic builder, cleanup also follows at most 16 actual native-image ancestors with the same owner and input fingerprint. Each owned intermediate keeps its own cleanup receipt. Cleanup stops before an unlabeled, different-owner or different-input ancestor and preserves any image still needed by a container or child image. No operation uses global Docker pruning.

## Create a compatible two-file backup

Run `npm run operate -- backup before-upgrade` after a successful drain. Use a simple name containing letters, digits, underscores or hyphens. Backups are private under `data/backups/<name>/`; keep them private when copying them elsewhere. Existing backup names are not overwritten.

A backup contains `application.db`, `native.db` and an integrity manifest. The application file contains scanner-owned state; the native file contains Mastra SDK state. The manifest binds both files to hashes, schema fingerprints, application schema version, storage compatibility identifier and the installed Mastra core/libSQL versions. Each database is limited to 512 MiB. The command uses SQLite snapshots rather than copying a changing main file without its WAL contents.

Keep the matching application code and dependency versions with the backup. Use a compatible local code version before restore. This command does not change code, migrate an unsupported schema or download dependencies. Unsupported application schema or SDK versions fail closed.

## Restore and recover an interruption

With the listener stopped, run `npm run operate -- restore before-upgrade`. Restore verifies the pair, manifest, hashes and compatibility before replacing live data. It checkpoints the owned live databases and rejects busy readers before clearing only their own WAL/SHM sidecars. A WAL belonging to the previous database must never be replayed onto the restored file.

The command preserves a prior usable snapshot of both files and writes a private restoration journal before either replacement. If the process stops between file replacements, the next startup or offline maintenance recovers the previous pair before opening either SDK database. `RECOVERED_PREVIOUS_PAIR` identifies this recovery. Failed recovery leaves the journal and prior copies in place and exposes `DEBT`; preserve `data/` and repair access rather than deleting the journal or partially opening the pair.

A completed restore expires stored approvals, pauses per-target recurrence and periodic advisory sync, and cancels pending recurrence/reassessment events. Review authorization, profiles and schedules deliberately before enabling new work. The encryption key is not included in a backup; an unavailable key still requires credential re-registration. `npm run operate -- status` reads the last operation result without contacting a target or model.
