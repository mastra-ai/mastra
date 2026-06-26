---
'@mastra/server': patch
'@mastra/core': patch
'@mastra/client-js': patch
'@mastra/react': patch
---

feat(playground): render ask_user tool as interactive question UI in Studio

Adds an `AskUserBadge` component that renders suspended `ask_user` tool calls
as interactive prompts with clickable option buttons (single/multi-select) or
free-text input. The user's answer is sent as `resumeData` through the existing
`sendToolApproval` flow to properly resume the tool.

Plumbing changes:
- `sendToolApprovalBodySchema` now accepts optional `resumeData`
- `agent.sendToolApproval()` passes custom `resumeData` when provided
- `@mastra/client-js` and `@mastra/react` expose the new parameter
