---
'@mastra/core': patch
---

Fixed queued messages and signals arriving too late during reasoning in the default agent loop. Reasoning-only model requests are cancelled and restarted with pending input in the same run, without keeping discarded reasoning in model history or interrupting text and tool output. Interrupted requests reuse the same logical step without consuming maxSteps, advancing stepNumber, or contributing token usage.
