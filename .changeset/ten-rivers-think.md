---
'@mastra/core': patch
---

Fixed semantic recall fetching all thread messages instead of only matched ones.

When using `semanticRecall` with `scope: 'thread'`, the processor was incorrectly fetching all messages from the thread instead of just the semantically matched messages with their context. This caused memory to return far more messages than expected when `topK` and `messageRange` were set to small values.

Fixes #11428
