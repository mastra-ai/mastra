---
'mastra': patch
---

Fixed `mastra deploy` failing with "No organizations found" in headless/CI when `MASTRA_API_TOKEN` is set and `.mastra-project.json` includes `organizationId`. Deploy now uses the configured organization directly.
