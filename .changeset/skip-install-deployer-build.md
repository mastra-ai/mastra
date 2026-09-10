---
'@mastra/deployer': patch
---

Add `MASTRA_BUILD_SKIP_INSTALL` to skip dependency installation during `mastra build`. When set to `true` or `1`, the deployer no longer runs the dependency install or generates a `package-lock.json` in the build output directory. This unblocks hermetic build systems (such as Bazel) that supply `node_modules` externally and run in a network-less sandbox, where the output install was previously both redundant and fatal. Default behavior is unchanged.
