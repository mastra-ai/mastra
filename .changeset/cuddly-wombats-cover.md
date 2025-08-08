---
'@mastra/core': patch
---

Fix tool arguments being lost when tool-result messages arrive separately from tool-call messages or when messages are restored from database. Tool invocations now correctly preserve their arguments in all scenarios.
