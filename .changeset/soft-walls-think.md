---
'@mastra/evals': minor
---

Added Quick Checks — composable micro-scorers for common eval assertions. New `checks` namespace provides zero-LLM, zero-ceremony scorers: `checks.includes()`, `checks.excludes()`, `checks.equals()`, `checks.matches()`, `checks.similarity()`, `checks.calledTool()`, `checks.didNotCall()`, `checks.toolOrder()`, `checks.maxToolCalls()`, `checks.usedNoTools()`, and `checks.noToolErrors()`. Available via `import { checks } from '@mastra/evals/checks'` or `import { checks } from '@mastra/evals/scorers/prebuilt'`. They compose into the existing `scorers: [...]` array anywhere scorers are used.
