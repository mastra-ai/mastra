---
'mastra': minor
'create-factory': minor
---

Moved Factory project creation into `create-factory` and exposed its reusable command API to `mastra factory create`. The default project now uses a release-compatible scaffold and explicit stable dependency ranges packaged with `create-factory`, eliminating the synchronized remote template; `--template` remains available for explicit custom Git templates.
