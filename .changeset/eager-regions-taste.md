---
'@mastra/core': patch
---

Fixed subagent traces being orphaned from the parent agent's trace when the built-in `subagent` tool is invoked from inside an agent run. Subagent spans now nest correctly under the parent agent's trace in observability backends like Langfuse. Fixes #15461.
