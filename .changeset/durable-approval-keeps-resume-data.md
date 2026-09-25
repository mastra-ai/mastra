---
'@mastra/core': patch
---

Fixed durable agents dropping custom resume data sent with a tool approval. `sendToolApproval({ approved: true, resumeData })` now reaches the tool's `context.agent.resumeData` on a durable agent, as it already did on a standard agent. A bare `{ approved: true }` still does not. Fixes #24561.
