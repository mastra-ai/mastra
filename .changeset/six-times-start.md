---
'@mastra/core': minor
---

You can now opt into parent-agent reuse for the separate structured-output pass with `structuredOutput: { schema, model, useAgent: true }`, which lets the structuring request reuse the parent agent config, including memory.
