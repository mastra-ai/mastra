---
"@mastra/core": patch
---

Stop logging client-disconnect aborts as `Error in LLM execution` at error level. The catch block in `agentic-execution/llm-execution-step.ts` now checks for `isAbortError(error)` first and exits via a `debug`-level log + the existing `onAbort` flow before the upstream-error / generic-error branches run. Closes #15844.
