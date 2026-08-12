---
'@mastra/memory': patch
---

Add opt-in pinned knowledge to Subconscious memory. When `pins` is enabled, the curator maintains a reserved `pinned-knowledge` page per scope and its body is delivered on every turn as a snapshot state signal, giving the store a small always-present content-bearing tier alongside the reactive reminder lane. Off by default, with a character budget enforced on the write path because the cost of a pin is per turn and permanent.
