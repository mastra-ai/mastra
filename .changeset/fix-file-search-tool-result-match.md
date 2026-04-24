---
'@mastra/core': patch
---

fix(core): match provider-executed tool results by toolName when toolCallId mismatches

When server-side tools like Google's `file_search` are combined with function-calling tools,
the Google AI SDK may assign different `toolCallId` values to the tool-call and tool-result
chunks. This caused `updateToolInvocation` to drop the result, leaving the stored message
with an incomplete tool call (state stuck at 'call'). On the next turn, replaying this
incomplete message to Gemini produces a "Corrupted tool call context" error.

Added a fallback in `updateToolInvocation`: when no exact `toolCallId` match is found, search
for a provider-executed (`providerExecuted: true`) tool-invocation part with the same
`toolName` that is still in `state: 'call'`. This safely handles ID mismatches for server-side
tools without affecting client-executed tools which always have stable IDs.
