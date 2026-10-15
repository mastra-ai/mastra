---
'@mastra/deployer': patch
---

Fixed `mastra build` and `mastra dev` failing with `DEPLOYER_BUNDLE_EXTERNALS_SHARED_CHUNK` in monorepos where a shared chunk contains code from more than one workspace package. These chunks are now written to the build output directory instead of aborting the build.
