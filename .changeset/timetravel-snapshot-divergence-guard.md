---
'@mastra/core': patch
---

Stop timeTravel from destroying a recorded workflow snapshot when the registered execution graph no longer matches the graph that produced the snapshot. Previously, timeTravel reconstructed run state by walking the current graph while reading the recorded snapshot, silently substituting empty objects for every step it could not find, and then persisted that reconstruction over the original snapshot, which was irreversible data loss. Two changes:

1. timeTravel now throws a descriptive error before anything executes or persists when a step that precedes the target in the current graph has no recorded entry in the snapshot. The error names the missing step ids and the ids the snapshot actually recorded, and the stored snapshot is left untouched. Note that this also applies to snapshots recorded before this release whose unnamed .map() steps carry randomly generated ids: those already failed to time travel across process restarts, but they previously got corrupted in the process; now they fail loudly with the snapshot intact.

2. Unnamed .map() steps now get deterministic ids (workflow id plus ordinal) instead of a random UUID per process, so time travel simply works across restarts for unchanged workflow code. An explicit id passed to .map() still wins, and a custom idGenerator configured on the Mastra instance is still consulted. If workflow code adds or removes .map() calls between the recorded run and the timeTravel call, later ordinals shift and the divergence guard reports it as a loud error instead of corrupting the snapshot.
