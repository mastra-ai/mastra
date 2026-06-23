---
"@mastra/core": patch
---

Fixed channel handlers so background tasks finish before responses are posted.

The channel handler was calling `agent.stream()`, which closes as soon as the
model finishes generating text. Any `agent.backgroundTask()` calls scheduled
during the turn were silently abandoned before they could complete.

Switch the call site to `agent.streamUntilIdle()` so the channel waits for all
background tasks to finish before posting the response and releasing the thread.

Fixes #16163
