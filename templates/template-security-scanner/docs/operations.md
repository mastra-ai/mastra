# Operations

Local state lives under private `data/`. The application database and its `-mastra.db` sibling belong together. **Settings** and `GET /api/operations` show retention and resource cleanup status.

## Stop and clean up

Stop the server with Ctrl+C before maintenance, then run `npm run operate -- drain`. This cancels pending work, expires related approvals, and reconciles recorded resources.

If drain reports incomplete cleanup, fix the reported access problem and retry. Images still used by another consumer are preserved. A live or uncertain instance returns `INSTANCE_ACTIVE`. After an interrupted lab session, run `npm run lab` again to reconcile its resources. Avoid global Docker pruning.

## Backup and restore

After a successful drain:

```sh
npm run operate -- backup before-upgrade
npm run operate -- status
```

Backups contain both databases and a compatibility manifest under `data/backups/<name>/`. Names accept letters, digits, underscores, and hyphens; existing backups aren't overwritten. Each database is limited to 512 MiB. Keep the matching code/dependencies and store the encryption key separately: it isn't included in the backup.

With the server stopped and compatible code installed:

```sh
npm run operate -- restore before-upgrade
```

Restore validates compatibility before replacing data, expires approvals, and pauses recurring work. Review credentials, authorization, and schedules before resuming.

If replacement is interrupted, the next startup or maintenance command restores the previous database pair and reports `RECOVERED_PREVIOUS_PAIR`. Preserve the recovery journal and prior copies if an error remains. `LEGACY_MASTRA_STATE` requires a compatible two-file backup or a lossless migration of the old database.

## Retention and key loss

`GET /api/retention` shows evidence cleanup status. To retry a failed batch, POST `{}` to `/api/retention/cleanup` using `Content-Type: application/json` alongside the normal session, Origin, and CSRF headers. Expired proof is unavailable even if the historical finding remains visible.

A missing or incorrect `SCANNER_ENCRYPTION_KEY` makes stored credentials unavailable. Restore the original key, or register credentials again under the current key and recheck identities. Previous scan and approval bindings don't authorize replacement credentials.
