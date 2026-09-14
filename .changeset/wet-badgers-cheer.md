---
'@mastra/inngest': patch
---

Fixed `createInngestAgent()` waking idle threads through the wrapped agent's in-process `stream()` when a signal arrived via `sendSignal()`, `sendStateSignal()`, or `sendNotificationSignal()`. Signal-started runs now take the Inngest durable path, and durable runs are registered with the thread runtime so `subscribeToThread()` and `getActiveThreadRunId()` can see them. Fixes [#23800](https://github.com/mastra-ai/mastra/issues/23800).
