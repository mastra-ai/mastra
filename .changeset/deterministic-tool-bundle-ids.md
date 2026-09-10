---
'@mastra/deployer': patch
---

Make `mastra build` output reproducible: tool bundles are now named from a hash of the tool's project-relative entry path instead of a random UUID, and the tool glob is sorted before ids are assigned, so two builds of the same sources emit the same `tools/*.mjs`, `tools.mjs` and chunk graph.
