---
'@mastra/core': minor
---

Added `disableBuiltinTools` to `HarnessConfig` so you can disable specific built-in harness tools.

Example:
`new Harness({ disableBuiltinTools: ['submit_plan', 'subagent'] })`
