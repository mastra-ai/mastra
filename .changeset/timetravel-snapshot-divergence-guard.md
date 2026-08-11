---
'@mastra/core': patch
---

Stop timeTravel from destroying recorded workflow snapshots. Two changes:

1. timeTravel now fails with a descriptive error and leaves the recorded snapshot unchanged when the workflow graph has changed since the run was recorded. Steps inside preceding foreach or loop entries are not inspected by this check.

2. Unnamed .map() steps now get deterministic ids, so timeTravel works across process restarts for unchanged workflow code. Removing a .map() call is not detected, so re-run rather than time travel after deleting a mapping step.
