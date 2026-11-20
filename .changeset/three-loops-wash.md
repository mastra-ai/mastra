---
'@mastra/core': patch
---

Fixed producer-only background tasks silently remaining pending when a tool requires local invocation context. Durable agents now use their existing synchronous fallback; direct callers receive an actionable error before a task is created.
