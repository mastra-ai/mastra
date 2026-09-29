---
'mastracode': patch
---

Fixed output speed readings that jumped to thousands of tokens per second. Thinking and text are now timed from when the model starts each block, so a block the provider holds and then sends all at once no longer reads as near-instant. When a provider sends a whole response at once, the reading keeps its previous value instead of showing an impossible rate.
