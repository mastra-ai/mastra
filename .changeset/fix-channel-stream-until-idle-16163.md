---
"@mastra/core": patch
---

fix(channels): use `agent.streamUntilIdle()` so channel handlers wait for background tasks

The channel handler was calling `agent.stream()`, which closes as soon as the
model finishes generating text. Any `agent.backgroundTask()` calls scheduled
during the turn were silently abandoned before they could complete.

Switch the call site to `agent.streamUntilIdle()` so the channel waits for all
background tasks to finish before posting the response and releasing the thread.

Fixes #16163
