---
'create-factory': patch
---

The factory template now ships a pnpm-workspace.yaml with allowBuilds, preventing pnpm v10+ from exiting with ERR_PNPM_IGNORED_BUILDS during install or build. The file mirrors the mastracode/web build-approval policy minus test-only deps stripped by the template.
