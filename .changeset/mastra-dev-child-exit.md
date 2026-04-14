---
"mastra": patch
---

Fixed `mastra dev` so shutdown and hot reload fully stop the previous server before continuing, reducing orphaned processes and port-in-use errors after terminal close or restart.
