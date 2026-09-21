---
'@mastra/e2b': patch
---

Commands without an explicit timeout now use the sandbox timeout (5 minutes by default) instead of hitting E2B's 60 second connection deadline and failing with `[deadline_exceeded]`.
