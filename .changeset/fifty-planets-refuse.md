---
'@mastra/core': patch
---

Fixed sub-agent delegation so nested tool results stay out of the parent model context by default while remaining available to application code. Set `delegation.includeSubAgentToolResultsInModelContext` to include the full subagent result in the parent model context.
