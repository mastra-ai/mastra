---
'@mastra/core': patch
---

Fixed tool execution errors stopping the agentic loop. The agent now continues after tool errors, allowing the model to see the error and retry with corrected arguments.
