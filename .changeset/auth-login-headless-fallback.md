---
'mastra': patch
---

Improved `mastra auth login` in agents, CI, and other non-interactive shells. It now explains right away how to authenticate there (sign in once in your own terminal, or set `MASTRA_API_TOKEN` and `MASTRA_ORG_ID`), and exits with an error instead of reporting success when browser sign-in doesn't complete. If `MASTRA_API_TOKEN` is already set there, it skips browser sign-in, and exits with an error if the token can't be verified or no organization is selected.
