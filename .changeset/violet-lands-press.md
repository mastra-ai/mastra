---
'@mastra/deployer': patch
---

Improved error messages when bundling fails during deployment.

**What changed:**

- Build errors now show clearer messages that identify the problematic package
- Added detection for common issues like missing native builds and unresolved modules
- Errors in workspace packages are now properly identified with actionable guidance
