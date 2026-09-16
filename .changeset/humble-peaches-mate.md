---
'mastra': patch
---

Fixed `mastra build` so an explicit `bundler.externals` array is respected as the complete custom external list, in addition to Mastra's global externals. Workspace packages listed in the array now remain external runtime dependencies instead of being bundled.