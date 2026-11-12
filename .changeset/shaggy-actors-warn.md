---
'@mastra/playground-ui': patch
---

Fixed chat tool cards showing a deferred call as running after its background task was cancelled. The card now says `cancelled` and no longer offers to answer a question the task asked before it stopped.
