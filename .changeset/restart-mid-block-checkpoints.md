---
'@mastra/core': patch
---

Fixed `restart()` and boot-time recovery re-running work that had already finished inside a `.parallel()` or `.foreach()` block. If the process died while the block was still running, arms and items that had completed ran their side effects a second time. Each finished arm or item is now saved as it completes, and a restart continues with the ones that were still unfinished. Fixes [#26214](https://github.com/mastra-ai/mastra/issues/26214).
