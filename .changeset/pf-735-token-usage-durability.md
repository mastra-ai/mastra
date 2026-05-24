---
'@mastra/core': patch
---

Fixed token usage tracking so counts persist across restarts, session evictions, interruptions, and background operations. Token totals are now calculated automatically when providers omit them.
