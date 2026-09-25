---
'@mastra/deployer': patch
---

Fixed workspace packages listed as externals being bundled instead of kept as runtime dependencies. Builds now resolve dependencies consistently from an app or monorepo root.
