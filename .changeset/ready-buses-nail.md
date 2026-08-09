---
'@mastra/core': patch
---

Fixed input processors receiving an undefined agent in their context when a durable agent run was resumed by a signal or schedule. The running agent is now passed through the processor workflow, so processors that rely on it (such as working memory and semantic recall) work correctly on wake.
