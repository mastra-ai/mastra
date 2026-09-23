---
'@mastra/core': patch
---

Tool calls whose approval policy is a function now run in parallel when that policy returns `false` for the actual call. This applies to the default `toolCallConcurrency` strategy and to `strategy: 'called'`. Previously, any function policy forced sequential execution. This included the policy that `MCPClient` attaches when `requireToolApproval` is a function. Each call's policy is evaluated once, and that verdict is reused when the tool runs.
