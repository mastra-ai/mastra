---
'@mastra/core': patch
'@mastra/blaxel': patch
'@mastra/e2b': patch
'@mastra/daytona': patch
---

fix: omit `processes` from sandbox provider constructor options

All sandbox providers (E2B, Daytona, Blaxel) were extending `MastraSandboxOptions` directly, exposing the internal `processes` field in their constructor options. Now uses `Omit<MastraSandboxOptions, 'processes'>` consistently, matching Local.
