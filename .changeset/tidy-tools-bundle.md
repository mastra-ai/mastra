---
'mastra': patch
---

Fixed `mastra dev` failing to start in monorepos when a tool file imports something from a workspace package that nothing else imports. The dev server no longer stops with `does not provide an export named ...`.
