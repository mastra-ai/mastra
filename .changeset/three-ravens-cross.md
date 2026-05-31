---
'@mastra/core': patch
---

Fix `AgentExecutionOptions` to use `extends object` instead of `extends {}` for structured output detection. The `{}` condition resolves differently under `strictNullChecks: false`, causing `undefined` (the default `TOutput`) to be treated as a concrete output type and making `structuredOutput` required in `defaultOptions`. Using `extends object` correctly excludes `undefined` and `unknown` from requiring structured output in both strict and non-strict projects.
