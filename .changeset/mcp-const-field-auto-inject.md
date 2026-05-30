---
'@mastra/core': patch
---

Fixed MCP tools with `const`-constrained or single-value `enum` discriminator fields (e.g. `"@type": { "const": "com.SomeSpec" }`) always failing validation. Mastra now automatically injects these predetermined values before validation runs.
