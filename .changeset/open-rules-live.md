---
'@mastra/core': patch
---

Fixed tool-not-found errors crashing the agentic loop. When a model hallucinates a tool name (e.g., Gemini 3 Flash adding prefixes like `creating:view` instead of `view`), the error is now returned to the model as a tool result instead of throwing. This allows the model to self-correct and retry with the correct tool name on the next turn. The error message includes available tool names to help the model recover. Fixes #12895.
