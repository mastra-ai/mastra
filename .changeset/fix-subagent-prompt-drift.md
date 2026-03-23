---
'@mastra/core': patch
---

Fixed sub-agent tool calls failing with "prompt: Invalid input: expected string, received undefined" when LLMs drift from using "prompt" to "query", "message", or "input" as the parameter name during repeated sub-agent calls via custom gateways. The tool input validation pipeline now normalizes these common aliases back to "prompt" before validation, preventing the error from reaching the LLM.
