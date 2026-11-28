---
'@mastra/deployer': patch
---

Fixed `mastra build` dropping the project's Bun `overrides` (or `resolutions`, when no `overrides` are set) from the install in `.mastra/output`. The output install now honors the project's override versions. Nested and `name@range` overrides are not copied yet.
