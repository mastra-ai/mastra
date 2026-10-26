---
'@mastra/core': patch
---

Stop waiting for a tool when its abort signal fires, even if the tool ignores cancellation. Release execution activity and discard late tool results or failures without changing timeout errors. Tool code and external side effects may continue after cancellation.
