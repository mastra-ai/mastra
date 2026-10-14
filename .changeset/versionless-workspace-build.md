---
'@mastra/deployer': patch
---

Fixed `mastra build` failing with `ERR_PNPM_PACKAGE_VERSION_NOT_FOUND` when the app imports a private workspace package that has no `version` field. Such packages are now packed under a placeholder `0.0.0` version.
