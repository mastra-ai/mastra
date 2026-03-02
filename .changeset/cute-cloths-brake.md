---
'mastra': patch
---

Fixed standalone Studio to honor `MASTRA_STUDIO_BASE_PATH` so subpath deployments load the correct base URL and static assets, while preserving query strings during asset rewrites and avoiding static-asset false positives on SPA routes.
