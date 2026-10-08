---
'@mastra/inngest': patch
---

Fixed `createInngestAgent` ignoring `stopWhen`. The agentic loop now evaluates `stopWhen` conditions after each step when the run executes in the process that started it, matching the core durable agent. On a cross-worker resume it still falls back to `maxSteps`.
