---
'@mastra/core': patch
---

Fixed the conversation context a supervisor forwards when it delegates to a sub-agent: a provider-executed tool result no longer survives without its tool call. A provider-executed tool call and its result are two parts of the same assistant message, so stripping only the call left an orphaned result that OpenAI rejected with "No tool call found for tool search output with call_id ...", which made every later delegation on that thread fail. Supervisor text replies are still passed through. Fixes [#30092](https://github.com/mastra-ai/mastra/issues/30092).
