---
'@mastra/core': patch
---

Fixed queued messages and signals arriving too late during reasoning in the default agent loop. Reasoning-only model requests are cancelled and restarted with pending input in the same run, without keeping discarded reasoning in model history or interrupting text and tool output. Interrupted requests count toward maxSteps.

Pending input is now batched at the start of each model step, before per-step input processors run. Messages and signals queued after a run starts but before its first step join the first model request and share its response, rather than receiving a separate response.
