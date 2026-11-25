---
'@mastra/core': patch
---

Knowledge change listeners (`knowledge.onChange()`, and Studio's live Knowledge view) now hear about pages an importer run creates, updates, moves or removes. Writes made in a `getStorage().transaction()` are reported once the transaction commits, and not at all if it rolls back.
