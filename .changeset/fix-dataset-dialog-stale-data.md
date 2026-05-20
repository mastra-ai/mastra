---
'@internal/playground': patch
---

Fixed Save as Dataset Item dialog showing stale data when trace details load asynchronously. The form now updates input, ground truth, and expected trajectory fields once trace data resolves, while preserving any edits the user already made before that data arrived.
