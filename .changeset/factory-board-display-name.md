---
'@mastra/factory': patch
---

Fixed Factory agents not finding a board by the name shown in the UI. Asking an agent to work on a renamed board, like "the Open source board" stored as `work`, now finds that board instead of reporting it missing. Work item listings also return each board's id and displayed name, and a name shared by several boards asks for the board's id instead of guessing. Fixes [#30461](https://github.com/mastra-ai/mastra/issues/30461).
