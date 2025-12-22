---
"@mastra/deployer-cloud": patch
---

Adds `--force` and `--legacy-peer-deps=false` flags to npm install command to ensure peer dependencies for external packages are properly installed in the mastra output directory. The `--legacy-peer-deps=false` flag overrides package manager settings (like pnpm's default of `true`) to ensure consistent behavior.

