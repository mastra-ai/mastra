---
'@mastra/playground-ui': patch
---

Feedback threads now show "Deleting…" on a comment while its deletion is processed, and hide its actions. If the deletion does not finish, the comment comes back with a "Could not delete feedback" error. A failed delete request also shows this error in the confirmation dialog, only until the dialog is closed.
