---
'@mastra/factory': patch
---

Fixed Factory kickoffs being delivered several times when they arrived while the previous run was ending. A kickoff queued onto an ending run is now resent only if it never showed up in the thread, and it is dropped instead of resent once the card has moved to another stage or its role was handed over. This stops a finished phase from restarting and pushing extra commits.
