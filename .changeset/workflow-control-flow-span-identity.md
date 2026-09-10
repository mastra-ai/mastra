---
'@mastra/core': patch
---

Workflow control-flow spans (parallel, conditional, loop, foreach) now use the authored graph entry `id` for their display name (e.g. `parallel: 'check-document'`) and expose the entry `id`, `description`, and `metadata` as span attributes. Spans without an authored `id` keep their previous structural name as a fallback.
