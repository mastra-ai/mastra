---
'@mastra/react': patch
---

Fixed @mastra/core being fully bundled into the @mastra/react dist instead of externalized. The nodeExternals() plugin wasn't catching workspace-linked packages, causing core's entire codebase to be inlined (923KB → 99KB after fix).
