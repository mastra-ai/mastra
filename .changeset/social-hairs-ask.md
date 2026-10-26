---
'@mastra/core': patch
---

Skip tool execution entirely when its abort signal is already aborted. For a tool that has already started, stop waiting when its abort signal fires, even if the tool ignores cancellation. Release execution activity and discard late tool results or failures without changing timeout errors. Already-started tool code and external side effects may continue after cancellation.
