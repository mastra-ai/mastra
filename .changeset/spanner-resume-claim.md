---
'@mastra/spanner': patch
---

Fixed concurrent resumes of the same suspended workflow run on Spanner all succeeding. When a transaction retried after an abort, a resume that lost the race could still report a win, so the run resumed more than once.
