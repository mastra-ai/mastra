---
'@mastra/core': patch
---

Fixed step scorers inside nested workflows never saving a score. The scorer hook looked up the child workflow on the Mastra instance, which throws because only the outer workflow is registered, so the score was dropped instead of falling back to the registered scorer.
