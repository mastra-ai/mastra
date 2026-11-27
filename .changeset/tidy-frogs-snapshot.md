---
'@mastra/elasticsearch': patch
---

Fixed workflow run snapshots that were written under a different key than the one they were read from, so a run's snapshot now survives a restart and can be resumed.

`persistWorkflowSnapshot` appended the resource id to the stored record's key, while loading, updating and deleting looked up the key without it. The two never met: a resumed run loaded no snapshot, and each persist left behind an orphaned copy. Snapshots are now keyed by workflow name, run id and nothing else — the same key readers use — and reads fall back to resource-id keys written by older versions, so existing runs keep loading.

Updates carry the resource id and original `createdAt` forward from whichever copy they found, `listWorkflowRuns` reports one entry per run instead of one per key and prefers the canonical copy, and deleting a run removes the legacy copies too.
