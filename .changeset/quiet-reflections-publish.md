---
'@mastra/memory': patch
---

Fixed buffered reflection values appearing in thread metadata before activation. Pending values survive reloads and are never published if their buffer is superseded. Background reflection also resumes for the newest memory generation when another process replaced the previous one while an awaited `onReflectionEnd` hook was still running. Staged values publish only when the storage adapter confirms its swap consumed that exact buffer (`bufferedReflectionVerified`); on an adapter that does not, the reflection still activates but its staged values stay unpublished. A buffered reflection that `afterReflection` empties no longer blocks the next buffering attempt, and one cleared with `clear()` while it waited no longer buffers for the recreated memory. Fixes [#27262](https://github.com/mastra-ai/mastra/issues/27262).
