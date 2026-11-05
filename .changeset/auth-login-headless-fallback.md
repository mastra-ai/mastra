---
'mastra': patch
---

Improved `mastra auth login` in agents, CI, and other non-interactive shells. It now prints instructions for using `MASTRA_API_TOKEN` right away, and exits with an error instead of reporting success when browser sign-in doesn't complete.
