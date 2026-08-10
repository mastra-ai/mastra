---
'mastra': minor
'create-factory': minor
---

Moved Factory project creation into `create-factory` and exposed its reusable command API to `mastra factory create`. Each release now generates and packages its default scaffold from `mastracode/web`, with Mastra dependencies aligned to the workspace versions assigned during release versioning. Runtime creation no longer fetches the synchronized remote template; `--template` remains available for explicit custom Git templates.
