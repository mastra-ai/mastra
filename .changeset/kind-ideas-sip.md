---
'@mastra/deployer': patch
'mastra': patch
---

Add Bun runtime detection for bundler platform selection

When running under Bun, the bundler now uses `neutral` esbuild platform instead of `node` to preserve Bun-specific globals (like `Bun.s3`). This fixes compatibility issues where Bun APIs were being incorrectly transformed during the build process.
