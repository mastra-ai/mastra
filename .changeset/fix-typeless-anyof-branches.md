---
'@mastra/core': patch
'@mastra/schema-compat': patch
---

fix: ensure all anyOf branches have a type key for OpenAI strict mode

`z.any().optional()` in agent delegation tool schemas (e.g. `resumeData`) was
producing `anyOf: [{ description: "..." }, { type: "null" }]` where the first
branch had no `type` key. OpenAI rejects this when using structuredOutput.

The OpenAI compat layer now expands typeless branches into concrete typed
branches, and `fixTypelessProperties` now recurses into anyOf/oneOf/allOf
branches while preserving a strict object variant with
`additionalProperties: false`.
