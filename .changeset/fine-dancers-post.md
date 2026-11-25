---
'@mastra/ai-sdk': patch
---

Fixed `toAISdkMessages`, `toAISdkV5Messages` and `toAISdkV4Messages` dropping user messages that mention `<system-reminder`. A message is now hidden only when it carries reminder metadata or its text is entirely a `<system-reminder>...</system-reminder>` block, so a question like "What does <system-reminder mean in the logs?" stays in the chat history.
