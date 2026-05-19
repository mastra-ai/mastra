---
"@mastra/acp": patch
"@mastra/evals": patch
"@mastra/deployer": patch
"@mastra/fastembed": patch
"@mastra/mcp": patch
"@mastra/editor": patch
"@mastra/memory": patch
"mastrai": patch
---

Removed zod as a required peer dependency. Internal schemas now use plain JSON Schema objects instead of zod runtime.
