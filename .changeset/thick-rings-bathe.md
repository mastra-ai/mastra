---
'@mastra/core': patch
---

Fixed `toolChoice: 'none'` removing tools from the model request, which made Amazon Bedrock drop earlier tool calls and reject thinking blocks.
