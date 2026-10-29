---
'@mastra/factory': patch
---

Made the work board's polling cheaper on large projects. Each poll used to copy every card of the project out of the server's list cache; it now reads the cached cards directly.
