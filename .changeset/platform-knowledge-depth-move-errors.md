---
'@mastra/platform': patch
---

Hosted Knowledge now rejects too-deep pages and too-large moves with `KnowledgePageDepthError` and `KnowledgeMoveTooLargeError`, the same errors local storage throws, instead of a plain `Error`. A hosted `KnowledgePageKeyConflictError` now carries its `key` and `parentId`, and `KnowledgeMoveTooLargeError` its `pageId` and `pages`, when the service sends them.
