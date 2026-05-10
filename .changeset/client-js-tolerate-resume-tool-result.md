---
'@mastra/client-js': patch
---

Tolerate `tool-result` chunks at the start of resume streams (`approve-tool-call`, `decline-tool-call`, `resume-stream`).

Previously, `processChatResponse` and `processChatResponse_vNext` threw `tool_result must be preceded by a tool_call` whenever a `tool-result` chunk arrived without a matching `tool-call` in the same stream. Because `processStreamResponse` always passes `lastMessage: undefined`, resume streams (which legitimately start with a `tool-result` whose matching `tool-call` was emitted in the prior turn) would trip this validation on every HITL approve/decline and pollute logs with `Error processing stream response: tool_result must be preceded by a tool_call` via the outer `.catch`.

The fix synthesizes a result-only invocation when `toolInvocations` is null at the time the chunk arrives. Strict desync detection is preserved: once a `tool-call` has populated the buffer, an unmatched `toolCallId` still throws `tool_result must be preceded by a tool_call with the same toolCallId`.
