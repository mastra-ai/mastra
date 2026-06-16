---
'@mastra/memory': patch
---

Prevent Observational Memory observer and reflector runs from blocking on their parent agent run by deriving an internal thread id for OM agent streams instead of reusing the parent thread id.
