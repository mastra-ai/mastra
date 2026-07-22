---
'mastra': patch
---

Added an internal `mastra/internal/auth` subpath export used by `create-factory` to reuse the CLI's browser-auth flow, credential store, and platform HTTP client. Not part of the CLI's public API — external consumers should keep using `mastra auth login` and the documented commands.
