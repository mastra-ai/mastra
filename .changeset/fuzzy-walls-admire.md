---
'@mastra/server': patch
---

Added server-side validation for agent avatar uploads. Avatar images in `metadata.avatarUrl` are validated for format (must be a data URL) and size (max 512KB decoded). Oversized uploads return HTTP 413, malformed data URLs return HTTP 400.
