---
'@mastra/core': patch
---

Fixed assistant message prefill error crashing sessions. When a model does not support assistant message prefill, the harness now automatically retries with a user message instead of failing.
