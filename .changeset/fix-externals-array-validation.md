---
'@mastra/deployer': patch
---

Fixed `mastra build` failing when a package listed in `bundler.externals` (array form) has a dependency that throws while loading — for example an older CommonJS module that touches an API removed in a newer Node version (such as `buffer.SlowBuffer` on Node 26). Packages you externalize are no longer executed during the build's validation step, so adding the package to `bundler.externals` now resolves the failure as the error message suggests.
