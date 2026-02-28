---
'@mastra/core': patch
---

Fixed an issue where agents would enter an infinite retry loop when LLMs omit optional fields inside nested objects. Tool inputs with missing nested fields are now handled gracefully.
