---
'@mastra/e2b': patch
'@mastra/platform-workspace': patch
---

Add `setEnvironmentVariable(name, value)` to E2BSandbox and PlatformSandbox. Values are overlaid onto every subsequent command's environment (never written into the VM), so they apply immediately, survive pause/resume, and reach replacement VMs. Hosts use this to install rotating credentials such as `GH_TOKEN` — previously the Factory's per-start token install silently no-opped on these providers, leaving `gh` unauthenticated inside session sandboxes.
