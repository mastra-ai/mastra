# Operations

Local state lives under private `data/`. `DATABASE_URL` holds application records; its sibling `-mastra.db` holds native Mastra state. Keep both files together. The console Settings view and `GET /api/operations` show operation status, retention debt, and pending image records.

## Stop and drain

Stop `npm run dev` or `npm run lab` with Ctrl+C before maintenance. Run `npm run operate -- drain` to reconcile recorded owned resources, cancel pending work, and expire related approvals. Repeat if it reports incomplete work. A live or ambiguous instance rejects maintenance with `INSTANCE_ACTIVE`.

Cleanup preserves unrelated resources and images with consumers. After the last consumer stops, run drain again. If cleanup reports `DEBT`, preserve its receipts and retry after fixing access. Do not manually prune the daemon. After an interrupted lab runner, run `npm run lab` again to reconcile its saved resources.

## Backup and restore

After a successful drain:

```sh
npm run operate -- backup before-upgrade
npm run operate -- status
```

Backups contain both database snapshots and an integrity/compatibility manifest under `data/backups/<name>/`. Names accept letters, digits, underscores, and hyphens. Existing names are not overwritten. Keep the matching code and dependency versions with the backup; each database is limited to 512 MiB. The encryption key is not included.

With the listener stopped and compatible code/dependencies installed:

```sh
npm run operate -- restore before-upgrade
```

New backups include immutable resource history and the current registration. Supported application-schema3 backups remain restorable: their original manifest, hashes, and schema are validated before a private staged upgrade. Saved backup files remain unchanged.

Restore verifies compatibility before replacing data. An interruption between file replacements is recovered to the previous pair on the next startup or maintenance command. `RECOVERED_PREVIOUS_PAIR` identifies that recovery. On failure, preserve the restoration journal and prior copies, repair file access, and retry.

Restore expires approvals and pauses recurrence/advisory schedules. Review authorization, credentials, and schedules before re-enabling work. `LEGACY_MASTRA_STATE` means a single-file database contains native SDK records; preserve it and use a compatible two-file backup or a separately reviewed lossless migration.

## Retention and key loss

Non-lab policies require an explicit retention period. `GET /api/retention` shows cleanup status; POST `{}` to `/api/retention/cleanup` with the normal session, Origin, and CSRF headers to retry a bounded batch. Failed storage cleanup returns `RETENTION_CLEANUP_FAILED` and records debt. Expired proof is unavailable even when its historical finding remains visible.

Keep the original `SCANNER_ENCRYPTION_KEY` private across restarts. If it is missing, wrong, or damaged, profiles return `CREDENTIAL_UNAVAILABLE`. Restore the retained key or re-register credentials under the current key, then check identity again. Old scan and approval bindings do not authorize the replacement credential.
