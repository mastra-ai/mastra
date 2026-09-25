---
'@mastra/core': patch
---

Fixed thread subscribers showing a run as idle after a tool approval. When a run resumes, thread subscribers now get a `start` event for the resumed part. This applies to subscribers that were already listening and to those that join while the run resumes, so the UI shows the run as running again and can cancel it.
