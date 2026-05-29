---
'mastra': patch
'@mastra/deployer': patch
---

Fixed false-positive LOCAL_STORAGE_PATH preflight errors caused by library code (e.g. Agent Builder prompt templates). Added a Rollup plugin (`mastra-local-storage-detector`) to the deployer that detects host-local storage URLs during bundling — only user modules are inspected (node_modules excluded), and tree-shaken code is ignored. The CLI preflight check now reads this bundler-generated metadata instead of scanning raw bundle source.
