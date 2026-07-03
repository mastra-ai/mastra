---
'@mastra/react': patch
---

Fixed Studio agent chat hanging on the first message when thread signals are enabled. When the thread subscription was aborted during mount, `useChat` cached the failed attempt and never retried it, so the assistant reply never arrived until a full page reload. The subscription is now retried on the next send, and a failed subscription no longer leaves the chat stuck in a pending state.
