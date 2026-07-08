---
'@mastra/memory': patch
---

Fixed Observational Memory writing `data-om-status` snapshots into persisted message history. The status part (a window-usage snapshot meant only for polling UIs) was emitted without the `transient` flag that every other OM lifecycle marker sets, so the stream writer persisted each snapshot as a standalone assistant message. On long-running threads this crowded real conversation turns out of paginated history reads. The status part is now marked transient and is no longer persisted. Fixes #18869.
