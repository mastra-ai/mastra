---
'@mastra/pg': patch
---

Fixed semantic recall performance that previously scaled linearly with message history size. Semantic recall now completes in under 500ms even for threads with 7,000+ messages, down from ~30 seconds. (Fixes #11702)
