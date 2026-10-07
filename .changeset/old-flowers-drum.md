---
'@mastra/core': patch
---

Fixed agents running out of memory when `untilIdle` is set in `defaultOptions`. `agent.stream()` and `agent.resumeStream()` now wait for background tasks once instead of looping endlessly before calling the model. Fixes [#26043](https://github.com/mastra-ai/mastra/issues/26043).
