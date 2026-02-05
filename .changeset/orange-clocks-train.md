---
'@mastra/ai-sdk': patch
---

Fixed handleChatStream not forwarding providerOptions to the agent stream.

- Added optional providerOptions to ChatStreamHandlerOptions so that provider-specific options (e.g. openai.reasoningEffort) are passed through to agent.stream() and agent.resumeStream().
- When providerOptions is passed at the top level of handleChatStream(), it is now merged into the options sent to the agent. Fixes #12572.
