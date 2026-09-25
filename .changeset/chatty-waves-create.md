---
'@mastra/deployer': patch
---

Fixed workspace externals being bundled instead of kept as runtime dependencies, and made dependency resolution consistent when building from an app or monorepo root.
