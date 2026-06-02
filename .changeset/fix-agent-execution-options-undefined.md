---
'@mastra/core': patch
---

Fixed `AgentExecutionOptions<undefined>` (and its public/inner variants) incorrectly requiring a `structuredOutput` property. When the output type is `undefined` or `null` — including a fully-nullish union such as `undefined | null` — `structuredOutput` is now correctly optional, regardless of the `strictNullChecks` setting. This is the shape produced by `AgentConfig.defaultOptions`, so `defaultOptions: { maxSteps: 50 }` now type-checks without a spurious `structuredOutput` requirement. Object output types still require `structuredOutput` as before.
