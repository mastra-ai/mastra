---
'@mastra/factory': patch
---

Fixed a reused Factory workspace keeping the reviewer GitHub token when the run-binding lookup fails. A session whose role cannot be read now falls back to the worker token (or repository access), and refresh callbacks from the earlier reviewer context are rejected. The reviewer token comes back once the review binding is readable again.
