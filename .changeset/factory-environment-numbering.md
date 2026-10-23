---
'@mastra/factory': patch
---

Fixed the repository list the agent sees in a multi-repository Factory session starting at 2 (or another number) instead of 1. The list was numbered with each repository's stored position, which keeps gaps when a project has repositories outside the environment. It is now numbered 1, 2, 3 in order.
