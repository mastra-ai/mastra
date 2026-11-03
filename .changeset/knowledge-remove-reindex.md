---
'@mastra/core': patch
---

Removed `knowledge.reindex()`. It re-embedded every page and note in the store, which is slow and costly on a large store. Pages and notes are embedded when they're written through the Knowledge tools, `upsertPage` or the note methods. If an embed fails, the write still succeeds and the content stays findable by keyword search; it's embedded again the next time it changes.
