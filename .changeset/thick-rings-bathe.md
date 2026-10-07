---
'@mastra/core': patch
---

Fixed `toolChoice: 'none'` removing the agent's tools from the model request. Tools are now kept so providers like Amazon Bedrock keep earlier tool calls and thinking blocks in the conversation. Tools are still removed when structured output is requested, which some providers like Gemini require. Fixes #25908.
