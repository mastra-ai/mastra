---
'mastra': patch
---

Fixed `mastra deploy` failing with "No organizations found" when using `MASTRA_API_TOKEN` in headless/CI environments. When `.mastra-project.json` contains an `organizationId` and `MASTRA_API_TOKEN` is set, the CLI now trusts the config directly instead of calling the orgs API (which API tokens lack permission to access).
