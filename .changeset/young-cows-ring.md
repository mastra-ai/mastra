---
'create-mastra': patch
---

Improve bundle size.

- Remove `fs-extra` dependency to use native Node.js APIs instead
- Replace `execa` with `tinyexec` for executing shell commands
