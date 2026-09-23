---
'@mastra/core': patch
---

Fixed nested workflow runs that end without completing being recorded on the parent as a successful step with no output. The parent step now fails with the real nested status. Loop conditions that throw now produce a normal failed run instead of a stuck 'running' snapshot. Agent runs report an error when invalid iteration output prevents completion.
