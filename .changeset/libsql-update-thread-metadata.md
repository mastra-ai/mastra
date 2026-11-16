---
'@mastra/libsql': patch
---

Fixed `updateThread` dropping metadata written by another writer when it was called without `metadata`, for example while saving a generated title.
