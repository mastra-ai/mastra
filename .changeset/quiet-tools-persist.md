---
'@mastra/editor': patch
---

Preserve static per-tool workspace settings when hydrating stored workspaces and snapshotting runtime workspaces. Per-tool enablement, approval requirements, and read-before-write controls now round-trip between storage and runtime configuration shapes without being silently dropped. Dynamic settings remain unpersisted.
