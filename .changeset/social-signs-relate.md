---
'mastra': minor
'create-factory': minor
---

Added `mastra factory create` and made `create-factory` a thin wrapper around the same CLI-owned project creation flow. Each `mastra` release now generates and packages its default scaffold from `mastracode/web`, with Mastra dependencies aligned to the workspace versions assigned during release versioning. Runtime creation no longer fetches the synchronized remote template; `--template` remains available for explicit custom Git templates.
