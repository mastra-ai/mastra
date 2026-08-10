---
'@mastra/react': patch
---

Fixed declined tool approvals leaving the tool call stuck in a pending state. When a tool requiring approval is declined, the React SDK now renders it as denied along with the decline reason.
