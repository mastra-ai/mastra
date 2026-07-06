---
'@mastra/react': patch
---

Fixed Studio agent chat hanging on the first message when thread signals are enabled. When the thread subscription was aborted during mount, `useChat` cached the failed attempt and never retried it, so the assistant reply never arrived until a full page reload. The subscription is now retried on the next send. Also, when a send fails for any reason (subscription setup, request, or stream), `useChat` now resets its running state instead of leaving the chat spinner stuck until reload.
