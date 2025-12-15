---
'@mastra/core': patch
---

What Changed:
Tool calls information from Cloudflare Workers ai now get properly processed and sent back to the model for final response geneartion.

How:
Step-result's finishReason from Cloudflare Workers ai is marked as stop when there are further tool calls involved, causing workflows to terminate without generating the final response with the tool call result. Now the field gets normalized to tool-calls when there are toolcalls left to execute. This fix makes so that even when the finishReason is stop, the workflow would resume, providing the final response.
