---
"@mastra/core": patch
"@mastra/server": patch
"@mastra/memory": patch
"@mastra/observability": patch
"@mastra/deployer": patch
"@mastra/playground-ui": patch
"@mastra/client-js": patch
"create-mastra": patch
"mastra": patch
---

Republished clean patch versions after compromised npm releases were published outside of the trusted release workflow.

These packages must be released as clean versions higher than the compromised versions currently present on npm so semver ranges resolve to trusted tarballs.
