---
'@mastra/react': patch
---

Fixed `useChat` leaving a pending user message in the chat after a send fails with thread signals enabled. The optimistic message is now removed when the server never accepted it, so retrying shows the message once instead of a stuck pending copy plus the retried one.
