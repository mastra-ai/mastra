---
'@mastra/playground-ui': patch
---

The chat `send` function from `useChatSend` can now return a promise. It resolves to `false` when the message never reached the server, so a composer can restore the text and attachments it had cleared.
