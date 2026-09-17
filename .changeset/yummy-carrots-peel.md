---
'@mastra/rag': patch
---

Fixed RAG document chunking so chunks no longer exceed maxSize when the configured overlap is large relative to maxSize. Previously a large overlap could carry over enough content to push the next chunk past the limit.
