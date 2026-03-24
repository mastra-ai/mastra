---
'@mastra/core': minor
---

Added `disabledBuiltinTools` to `HarnessConfig` so you can disable specific built-in harness tools.

Example:
`new Harness({ disabledBuiltinTools: ['submit_plan', 'subagent'] })`
