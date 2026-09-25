---
'@mastra/core': patch
---

Fixed agents sending an invented `.` user message before a conversation that starts with an assistant message, such as a voice agent that greets first. Mastra now adds it only for Amazon Bedrock and Google Gemini, which reject assistant-first conversations. OpenAI, Anthropic, Groq and other providers get the conversation unchanged. Input processors never see the added message, and it is still not saved to memory. Fixes [#22874](https://github.com/mastra-ai/mastra/issues/22874).
