---
'@mastra/core': patch
---

Fixed agent runs that reported an API error instead of an abort when the run was cancelled while an error processor was still handling that error.
