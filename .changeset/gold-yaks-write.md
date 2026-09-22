---
'@mastra/deployer': patch
---

Fixed `mastra build` discarding pnpm patches. Patched dependencies declared in your workspace are now carried into the built output, so deployed apps run the same patched code as your source project.
