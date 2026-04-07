---
'@mastra/core': patch
---

Added AI SDK v6 UI message support to MessageList in @mastra/core.

MessageList can now accept AI SDK v6 UI and model messages in add(...), and project stored messages with messageList.get.all.aiV6.ui(). This adds first-class handling for v6 approval request and response message flows.
