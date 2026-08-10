---
'mastracode': patch
---

Fixed duplicate `Thinking...` lines in the chat transcript. When a model emitted more than one reasoning span in a single step, each span rendered its own label; consecutive hidden reasoning parts now collapse into a single `Thinking...` line.
