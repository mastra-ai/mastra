---
'@internal/playground': patch
---

Fixed the trace panel's "Save as Dataset Item" form opening with empty Input and Ground Truth fields when the user clicked the button before the root span's full details had been fetched. The dialog now waits for the span data to arrive and seeds the fields once available (and disables Save while loading), mirroring the existing async-load behavior for Expected Trajectory.
