---
'@mastra/deployer-cloud': patch
---

Fixed "Detected unsettled top-level await" warning in cloud deployments when users set bundler externals as an array (e.g. `externals: ["@mastra/auth"]`). The cloud deployer now always uses `externals: true` regardless of custom bundler config, since dependencies are installed from npm and bundling them inline can cause circular module evaluation deadlocks.
