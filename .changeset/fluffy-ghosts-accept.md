---
'mastracode': patch
---

Added macOS sleep prevention while Mastra Code is actively running.

Mastra Code now starts the built-in caffeinate utility only while an agent run is in progress, then releases it after completion, aborts, errors, or app shutdown.

To opt out, set MASTRACODE_DISABLE_CAFFEINATE=1 before launching Mastra Code.
