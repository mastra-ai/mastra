---
'@mastra/memory': patch
---

Improved observational memory finalization defensively: persistence and idle buffering use the terminal message list accepted by the processor pipeline rather than the list captured by the observation turn. Invariant tests cover distinct-list ownership and removed output. This is hardening, not a confirmed fix for #25023; the reported message loss remains unreproduced and the issue stays open.
