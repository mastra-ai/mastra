---
'mastra': patch
---

Fixed `mastra dev` leaving the child dev server running after exit or restart, which blocked the next run from starting with a port-in-use error. Fixes #15021.
