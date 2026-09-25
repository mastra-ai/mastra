---
'@mastra/deployer': patch
---

Fixed workspace packages listed as externals being bundled or missing from deployable output. They now remain runtime dependencies packaged with the build. Builds also resolve dependencies consistently from an app or monorepo root.
