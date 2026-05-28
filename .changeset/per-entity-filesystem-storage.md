---
'@mastra/core': minor
---

Add per-entity file persistence and per-entity git history to `FilesystemVersionedHelpers`.

`FilesystemVersionedHelpers` now accepts three optional hooks that let a storage
domain split a published entity across many per-entity JSON files (e.g.
`agents/<id>.json`) instead of one shared map file:

- `perEntityFilesDir` — directory (under the FilesystemDB root) for per-entity files.
- `shouldPersistToPerEntityFile(entity)` — decide per published entity whether
  to write its snapshot to a per-entity file.
- `perEntitySnapshotFilter(snapshot, entity)` — filter the snapshot before
  writing it to the per-entity file (e.g. drop fields the user does not own).

When configured, the helper:

- Reads per-entity files on hydrate (alongside the shared map file).
- Writes published snapshots to per-entity files with stable alphabetical key
  ordering for friendly diffs.
- Walks per-entity file git history and surfaces each commit as a read-only
  version in `listVersions` (in addition to the existing shared-file git
  history).
- Skips writing an empty shared map file when every published entity is
  persisted to per-entity files, so a code-only project does not end up with an
  empty stub committed to git.

Also adds `FilesystemDB.listDomainFiles`, `domainFileExists`, and
`removeDomainFile` helpers, and broadens `GitHistory.getFileAtCommit` to be
generic so callers can request a per-entity snapshot type rather than the
shared-map shape.
