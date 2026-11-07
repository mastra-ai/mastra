---
'@mastra/memory': patch
---

Keep the signed reasoning block of a tool call when observational memory prunes around it. The pruned history kept the pending call but dropped its thinking block, which broke replay of signed reasoning.
