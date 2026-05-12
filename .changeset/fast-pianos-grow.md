---
'@mastra/libsql': patch
---

**Fixed** Workflow run snapshots no longer lose fields when serialized for storage. The libsql `safeStringify` cycle-detection treated any object that appeared more than once in a snapshot as a circular reference and dropped it. Because `snapshot.result` and the final step's `context[step].output` share the same reference on success, `snapshot.result` was being silently stripped on every persist. This caused `listWorkflowRuns` to return runs with `snapshot.result === undefined` and broke workflow resume when suspended-state fields were shared elsewhere in the snapshot.
