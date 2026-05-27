---
'@mastra/deployer': patch
---

Fixed a deployer bundling regression where custom bundler externals could override safe Mastra runtime externals. This preserves internal runtime externalization and prevents ESM top-level await deadlocks from self-importing generated bundles, fixing the regression of #14860/#14863.
