---
'@mastra/core': patch
---

Fixed transient signals duplicating within a turn. A processor that re-sends a transient reminder (e.g. via sendSignal with transient: true in processInputStep) now keeps a single fresh copy near the latest message instead of accumulating one copy per model call. Fixes https://github.com/mastra-ai/mastra/issues/22060
