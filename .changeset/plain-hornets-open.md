---
'@mastra/deployer': patch
---

Fix a bug where unused imports (that we not imported into the main entry point) were being tree-shaken away during analysis, causing errors during bundling. Tree-shaking only happens during bundling now.
