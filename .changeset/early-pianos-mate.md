---
'@mastra/inngest': patch
---

Fixed `createInngestAgent` ignoring lifecycle callbacks set in the agent's `defaultOptions` (such as `onStepFinish` and `onFinish`). Inngest agents now fire these defaults from `stream()`, `generate()`, `resume()`, and `resumeGenerate()` just like plain and durable agents, and callbacks passed at call time still take precedence. Fixes [#26527](https://github.com/mastra-ai/mastra/issues/26527).
