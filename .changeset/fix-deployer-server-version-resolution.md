---
"@mastra/deployer": patch
---

Fix npm resolving wrong @mastra/server version

Changed `@mastra/server` dependency from `workspace:^` to `workspace:*` to prevent npm from resolving to incompatible stable versions (e.g., 1.0.3) instead of the required beta versions.

