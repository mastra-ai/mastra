---
'@mastra/factory': patch
---

Fixed re-review runs after a push restating the previous verdict instead of reviewing the new commit. Each review pass now names the pull request head it covers and, after a recorded verdict, the head that verdict was given on, and the pushed head is recorded before the push starts the next pass.
