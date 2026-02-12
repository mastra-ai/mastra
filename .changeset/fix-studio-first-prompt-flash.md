---
'@mastra/playground-ui': patch
---

Fixed chat flashing empty state when sending the first message on a new thread. Stabilized the empty messages array fallback so useChat doesn't reset streamed messages during the /chat/new to /chat/<uuid> URL transition.
