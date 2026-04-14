---
'@mastra/ai-sdk': patch
---

Fixed tool call approvals in AI SDK v6: `handleChatStream` now automatically routes to `resumeStream` when the AI SDK v6 `approve()` method is used on the client, enabling the suspend/resume flow without any extra server-side wiring. The v6 stream now also emits native `tool-approval-request` parts alongside the existing `data-tool-call-approval` chunk for backwards compatibility with `@mastra/react`.
