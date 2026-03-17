---
"mastra": patch
"@mastra/deployer": patch
---

Added a new `MASTRA_TEMPLATES` Studio runtime flag to control whether the **Templates** section appears in the sidebar.

- `MASTRA_TEMPLATES=true` now enables Templates navigation in Studio.
- By default (`false` or unset), Templates is hidden.
- Studio HTML injection now propagates this value in both CLI-hosted and deployer-hosted Studio builds.
- Added tests covering environment variable injection for both paths.
