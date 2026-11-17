---
'@mastra/core': patch
---

Corrected the `Mastra.addTool()` JSDoc. It now says that adding a tool with a key that is already registered keeps the existing tool and returns without an error. The JSDoc previously said this case throws.
