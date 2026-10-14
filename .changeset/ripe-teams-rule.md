---
'@mastra/factory': patch
'@mastra/core': patch
---

Fixed new interactive chats ignoring the user's default model. New chats now start on the default model set in Factory settings, while resumed chats keep the model picked on them and Factory runs keep the project default. Fixes [#25503](https://github.com/mastra-ai/mastra/issues/25503).
