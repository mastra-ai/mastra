---
'@mastra/core': patch
'mastracode': patch
---

Fixed thread auto-resume selecting wrong thread in git worktrees and failing to find threads after resourceId changes. Thread selection now filters by projectPath and falls back to a cross-resource metadata query when the resourceId drifts.
