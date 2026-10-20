---
'@mastra/code-sdk': patch
---

Mastra Code sessions woken by a signal or notification now get their run options from the agent's `wakeOptions` hook, so woken runs keep the session's model and request context.
