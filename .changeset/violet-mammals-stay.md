---
'@mastra/core': patch
---

Fixed memory history regeneration to recall only messages before the target assistant response and delete the replaced branch after the new response is saved. Server-history recovery also removes server-marked incomplete assistant responses before recalling stored history.
