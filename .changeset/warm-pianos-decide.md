---
'@mastra/core': patch
---

Fixed goals using up a run when the goal judge errors. A failed judge call (for example, a dropped network connection) still pauses the goal so it can be resumed, but the failed attempt no longer counts against the goal's run limit. Fixes [#22446](https://github.com/mastra-ai/mastra/issues/22446).
