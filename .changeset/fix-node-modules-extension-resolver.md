---
'@mastra/deployer': patch
---

Fixed bundling issues for packages without an `exports` field in their package.json.

Previously, the deployer could produce incorrect import paths for older npm packages that don't use the modern exports map (like lodash). This caused runtime errors when deploying to production environments.

The fix ensures these packages now resolve correctly, while packages with proper exports maps continue to work as expected.
