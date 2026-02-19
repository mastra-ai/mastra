---
'@mastra/core': patch
---

fix(core): continue agentic loop on tool execution errors instead of bailing

Previously, the agentic loop would bail (stop) when a tool execution error occurred, preventing the LLM from seeing the error and retrying with corrected arguments. Now the loop continues for all tool errors (not just ToolNotFoundError), allowing the model to self-correct on tool failures.
