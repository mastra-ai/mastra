---
'@mastra/memory': patch
---

Fixed the Subconscious curator writing into the parent conversation. It forwarded the parent's request context unchanged, and the parent's thread id in it outranked the curator's own thread, so the curator's input and reply landed in the parent thread and its own thread was never created. The curator now runs on its own thread.
