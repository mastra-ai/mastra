---
'@mastra/core': patch
---

Skip tool execution entirely when its abort signal is already aborted. For a tool that has already started, stop waiting when its abort signal fires, even if the tool ignores cancellation. Release execution activity and discard late tool results or failures without changing timeout errors. This also applies to eager tool execution: caller cancellation no longer waits for running tools and may discard results not yet recorded in the conversation, even if the tool has already returned. Retry and fallback still reuse completed eager work. Already-started tool code and external side effects may continue after cancellation.
