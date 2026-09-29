---
'@mastra/memory': patch
---

Fixed `getSystemMessage()` returning working memory instructions that contained the word "null" when no working memory had been saved yet. It now shows "No working memory data available." instead. Fixes [#23724](https://github.com/mastra-ai/mastra/issues/23724).
