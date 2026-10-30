---
'@mastra/ai-sdk': patch
---

Added `delegatedToolCallId` and `delegatedToolName` to `data-tool-call-suspended` and `data-tool-call-approval` parts. When a supervisor delegates to a subagent, they name the subagent's tool call that paused, so a UI can label the prompt it shows. Fixes #28583.

```tsx
const part = message.parts.find(p => p.type === 'data-tool-call-suspended')
part?.data.toolCallId // the supervisor's call to the subagent, use it to resume
part?.data.delegatedToolCallId // the subagent's own tool call that paused
part?.data.delegatedToolName // e.g. "ask"
```
