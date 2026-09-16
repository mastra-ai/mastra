---
'@mastra/editor': patch
---

Fixed hydrating a stored processor graph so that graph nodes reusing the same processor no longer collapse into a single workflow step. Each node now keeps its own unique step identity, preventing configured nodes from overwriting each other and keeping parallel and conditional branch results distinguishable.
