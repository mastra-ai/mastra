---
'@mastra/platform': patch
---

Hosted Knowledge now rejects too-deep pages and too-large moves with `KnowledgePageDepthError` and `KnowledgeMoveTooLargeError`, the same errors local storage throws, instead of a plain `Error`.
