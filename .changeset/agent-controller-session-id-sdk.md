---
'@mastra/code-sdk': patch
---

Background task completions and notification wake-ups now find their session by session id, so they keep reaching the right session when several sessions share one resource.
