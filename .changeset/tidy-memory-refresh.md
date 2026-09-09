---
'mastra': patch
---

Fixed the Studio working memory sidebar showing stale content. It now refreshes after observational memory updates, after background buffering completes, and after the agent updates working memory mid-stream, without flashing a loading state while it refetches.
