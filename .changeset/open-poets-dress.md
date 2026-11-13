---
'@mastra/deployer': patch
---

Fixed `mastra build` dropping the project's `overrides` (or `resolutions`, when no `overrides` are set) from the Bun install in `.mastra/output`. The deployed server now installs the versions the project pinned (for example a patched `uuid`) instead of resolving them again ([#29311](https://github.com/mastra-ai/mastra/issues/29311)).
