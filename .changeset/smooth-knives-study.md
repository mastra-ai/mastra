---
'@mastra/code-sdk': patch
---

Fixed Mastra Code reporting internal turn failures as cancellations in connected editors. Clients now receive the original error when a failure aborts the turn without a client cancellation.
