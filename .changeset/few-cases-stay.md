---
'@mastra/core': patch
---

Fixed AI SDK v6 message conversion crashing when an opening reasoning part has no text or details. Empty parts omitted by the existing v5 conversion stay omitted, while text, tool state, and nonempty reasoning remain unchanged.
