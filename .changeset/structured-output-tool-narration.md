---
'@mastra/core': patch
---

Fixed `structuredOutput` validating text written before a tool call. Agents that narrate ("Let me look that up.") before calling tools no longer fail with a structured output validation error and end the run early, and `stream.object` now resolves to the final answer instead of an intermediate JSON draft. Durable agents also return the final answer instead of the first JSON they saw. ([#25038](https://github.com/mastra-ai/mastra/issues/25038))
