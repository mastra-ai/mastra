---
'@internal/playground': patch
---

Fixed Save as Dataset Item dialog showing stale data when trace details load asynchronously. The form now correctly updates input and ground truth fields once the span detail query resolves, instead of requiring the user to close and reopen the dialog.
