---
'@mastra/deployer': patch
---

Fixed "Error: ENOTDIR: not a directory, open '...chunk-XYZ.js/package.json'" errors being printed during `mastra build` when using custom bundler options without `externals: true`. Package resolution no longer treats module files as directories when looking up dependency metadata, so builds run without these confusing (but harmless) errors in the output.
