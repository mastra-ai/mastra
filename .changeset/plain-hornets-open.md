---
'@mastra/deployer': patch
---

Fixed a bug where imports that were not used in the main entry point were tree-shaken during analysis, causing bundling errors. Tree-shaking now only runs during the bundling step.
