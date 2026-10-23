---
'@mastra/memory': patch
---

Fixed working-memory data leaking into recalled history after raw message writes and partial message edits. Preserved observation markers and omitted content fields. Message edits now index the visible text the message keeps after the edit, so semantic recall no longer drops a message whose edit only touches working memory or metadata. Fixes [#27946](https://github.com/mastra-ai/mastra/issues/27946).
