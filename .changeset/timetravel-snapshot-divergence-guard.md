---
'@mastra/core': patch
---

Stop timeTravel from destroying recorded workflow snapshots. Two changes:

1. timeTravel now rejects a diverged workflow with a descriptive error before anything executes or persists. The stored snapshot is left untouched. Previously it silently reconstructed missing steps as empty objects and overwrote the snapshot, which was irreversible data loss. Snapshots recorded before this release with randomly generated unnamed .map() ids now fail loudly instead of being corrupted. The guard does not inspect steps inside preceding foreach or loop entries, since a run can legitimately record zero iterations.

2. Unnamed .map() steps now get deterministic ids (workflow id plus ordinal) instead of a random UUID per process, so time travel works across restarts for unchanged workflow code. Explicit .map() ids and a custom idGenerator still win. Adding a .map() call before the target after the run was recorded triggers the guard; removing one is not detected, so re-run rather than time travel after deleting a mapping step.
