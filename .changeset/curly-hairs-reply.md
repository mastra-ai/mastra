---
'@mastra/memory': patch
---

Fixed a bug where temporal gap markers caused message duplication and history corruption. When observational memory temporal markers were enabled, inserting a gap marker destructively cleared and rebuilt the entire in-memory message list. This broke internal deduplication and sealed-message boundaries, causing identical messages to appear twice in the thread history. The marker is now added directly without rebuilding the list.
