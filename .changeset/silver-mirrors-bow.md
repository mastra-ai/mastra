---
'@mastra/ai-sdk': patch
---

Fixed progressive streams for deeply nested agents. `data-tool-agent` and `data-tool-agent-step` parts now include the ordered delegation path, nesting depth, and immediate parent agent ID.
