---
'@mastra/memory': patch
---

Fixed deleted threads leaving observational memory behind. Deleting a thread now waits for any in-flight observational-memory cycle on that thread before cleaning up, and a cycle that finishes after its thread was deleted no longer writes observation vectors or recreates the thread's memory record. Previously, text from a deleted thread could stay searchable through resource-scoped recall. Fixes #23177.
