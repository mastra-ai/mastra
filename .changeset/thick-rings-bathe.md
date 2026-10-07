---
'@mastra/core': patch
---

Fixed `toolChoice: 'none'` removing tools from the model request, which made Amazon Bedrock drop earlier tool calls and reject thinking blocks. Tools are still removed when direct structured output is requested, since some providers reject tools together with a JSON response format.
