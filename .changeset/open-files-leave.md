---
'@mastra/core': patch
---

Fixed a prompt waiting on the user disappearing from the session's display when another run on the same thread finished. The prompt could still be answered, but nothing showed it. Only the ending run's own prompts are now cleared.
