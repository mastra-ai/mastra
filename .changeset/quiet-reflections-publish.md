---
'@mastra/memory': patch
---

Fixed buffered reflection values appearing in thread metadata before activation. Pending values survive reloads and are never published if their buffer is superseded. Background reflection also resumes for the newest memory generation when another process replaced the previous one while an awaited `onReflectionEnd` hook was still running. Fixes [#27262](https://github.com/mastra-ai/mastra/issues/27262).
