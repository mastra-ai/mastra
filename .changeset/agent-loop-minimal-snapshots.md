---
'@mastra/core': patch
---

Fix workflow snapshot bloat on agent HITL tool-approval suspensions (#18647). Agent-run snapshots previously grew with thread length × number of historical suspensions because completed steps retained stale `suspendPayload`s (each embedding a full serialized message list) and duplicated message arrays across step payloads and outputs. Snapshots could balloon to 5MB+ on long threads and hit storage row-size limits.

Agent-loop snapshots are now pruned to minimal resume artifacts before persist: completed steps drop suspension payloads and heavy message/step data, while suspended steps keep their full resume state intact. Snapshot size now stays flat across sequential approvals — O(thread) instead of O(suspensions × thread).

This also adds an optional `pruneSnapshot` workflow option (alongside `shouldPersistSnapshot`) that transforms a snapshot immediately before it is persisted. User-authored workflows are unaffected and persist full snapshots by default.
