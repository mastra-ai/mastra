---
'@mastra/core': patch
---

Fixed agents with working memory seeing the word "null" in their instructions when no working memory had been saved yet, for example on the first message of a new thread. The agent now sees "No working memory data available." instead. Fixes [#23724](https://github.com/mastra-ai/mastra/issues/23724).
