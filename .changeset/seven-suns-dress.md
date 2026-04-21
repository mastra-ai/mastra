---
'@mastra/ai-sdk': patch
---

Fixed tool call approvals in AI SDK v6: `handleChatStream` now automatically routes to `resumeStream` when the AI SDK v6 native approval flow is used on the client (no extra server-side wiring required). The v6 stream now emits native `tool-approval-request` parts so `useChat` can surface approval UI and call `addToolApprovalResponse()`, while also emitting the existing `data-tool-call-approval` chunk for backwards compatibility.
