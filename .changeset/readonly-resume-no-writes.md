---
'@mastra/core': patch
---

Fixed `resumeGenerate()` and `resumeStream()` saving messages to the thread when `memory.options.readOnly` is `true`. Resuming a suspended run now leaves read-only threads untouched, matching `generate()` and `stream()`.
