---
'@mastra/core': patch
---

Fixes a TypeScript typing bug so agents with `undefined` or `null` output no longer require `structuredOutput` in both strict and non-strict compilation modes.
