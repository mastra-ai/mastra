---
'@mastra/ai-sdk': minor
'@mastra/core': minor
---

You can now opt into parent-agent reuse for the structuring agent pass with `structuredOutput: { schema, model, useAgent: true }`, which lets the separate structuring request re-use the parent agents config, including memory.
