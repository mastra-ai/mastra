---
'@mastra/core': patch
---

Fixed agents sending an invented `.` user message before a conversation that starts with an assistant message, such as a voice agent that greets first. Mastra now adds it only for Amazon Bedrock and Google Gemini, which reject assistant-first conversations. OpenAI, Anthropic, Groq and other providers get the conversation unchanged. The message is added by the default `ProviderHistoryCompat` processor, after your input processors run, and is still not saved to memory. Fixes [#22874](https://github.com/mastra-ai/mastra/issues/22874).

`MessageList` prompt getters (such as `messageList.get.all.aiV5.prompt()`) no longer add the `.` message, and the `ensureGeminiCompatibleMessages` helper is removed. If you build prompts from a `MessageList` yourself and send them to Bedrock or Gemini, add the user turn before a leading assistant message:

```ts
const prompt = messageList.get.all.aiV5.prompt();
const first = prompt.findIndex(message => message.role !== 'system');
if (prompt[first]?.role === 'assistant') {
  prompt.splice(first, 0, { role: 'user', content: '.' });
}
```
