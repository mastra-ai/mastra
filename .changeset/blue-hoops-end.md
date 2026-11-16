---
'@mastra/factory': minor
'@mastra/libsql': patch
'@mastra/pg': patch
---

New factories no longer create database columns and tables that nothing reads. Existing factories keep working: the old columns and their data stay in place, and the factory simply stops writing them.

**Removed**

- The `filesystem_snapshots` and `intake_label_routes` tables are no longer created, and the background file-listing capture that filled `filesystem_snapshots` no longer runs.
- The `waitForPendingFilesystemCapture` export is removed. Remove any call to it; there is nothing left to wait for.
- Project repository responses no longer include `sandboxWorkdir` or `lastBuiltAt`, and linking a repository no longer accepts `sandboxWorkdir`.

**Upgrading**

Update `@mastra/pg` or `@mastra/libsql` together with `@mastra/factory`. Older adapter versions keep the retired columns required on existing databases, which makes card, rule and repository writes fail.
