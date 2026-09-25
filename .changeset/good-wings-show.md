---
'@mastra/core': patch
---

Fixed slow loading of long conversation histories. Loading stored messages took time that grew with the square of the thread length, so a thread with 10,000 messages could block the server for several seconds on every load. Loading now grows linearly with the thread length. Fixes [#24143](https://github.com/mastra-ai/mastra/issues/24143).
