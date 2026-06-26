---
'@mastra/core': patch
---

Fixed a thread becoming permanently unresponsive after a signal woke it without anyone reading the agent's response.

When a signal woke a thread in the background and nothing consumed the resulting run, the run never finished and the thread stayed busy forever. Any further signals sent to that thread were then absorbed by the stuck run instead of starting a new one, so the agent stopped responding on that thread. Threads where you read the agent's response normally were never affected. Background-woken threads now finish on their own and keep accepting new signals.

Also fixed `consumeStream()` so that `await consumeStream()` always waits for the run to actually finish, even when consumption was already started elsewhere, and so that every caller's `onError` runs if the stream fails.
