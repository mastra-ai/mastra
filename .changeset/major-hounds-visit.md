---
'@mastra/ai-sdk': patch
---

Added toAISdkMessages() for loading stored Mastra messages into AI SDK v5 or v6 chat UIs.

Use the default v5 behavior or pass { version: 'v6' } when your app is typed against AI SDK v6 useChat() message types.
