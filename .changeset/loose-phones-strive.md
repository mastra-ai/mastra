---
'@mastra/core': patch
---

Message history is now append-only. When an agent run fails or times out, memory keeps what happened in that turn (the user's message, completed steps and the error) instead of dropping it. Previously a run that errored before producing any output removed the user's message from history, so retries lost context and prompt caching broke.
