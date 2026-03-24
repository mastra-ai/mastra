---
'@mastra/core': patch
---

Fix consecutive tool-only loop iterations being merged into a single assistant message block. When the agentic loop runs multiple iterations that each produce only tool calls, the LLM would misinterpret them as parallel calls from a single turn. A `step-start` boundary is now inserted between iterations to ensure they are treated as sequential steps.
