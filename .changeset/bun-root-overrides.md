---
'@mastra/deployer': patch
---

Fixed `mastra build` dropping the project's Bun `overrides` (or `resolutions`, when no `overrides` are set) from the install in `.mastra/output`. The deployed server now gets the versions the project pinned instead of resolving them again. Nested and `name@range` overrides are not copied yet.
