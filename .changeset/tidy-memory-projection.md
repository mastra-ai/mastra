---
'@mastra/memory': patch
---

Fixed working-memory data leaking into recalled history after raw message writes and partial message edits. Preserved observation markers and omitted content fields. Fixes [#27946](https://github.com/mastra-ai/mastra/issues/27946).
