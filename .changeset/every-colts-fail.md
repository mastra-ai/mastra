---
'mastracode': patch
'@mastra/core': patch
---

Fixed messages queued during an active agent run being dropped when that run is aborted. Queued messages now start their own run after the abort instead of inheriting the aborted run's cancellation.
