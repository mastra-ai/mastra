---
'@mastra/deployer': patch
---

Added `MASTRA_HOST` environment variable support for configuring the server bind address. Previously, the host could only be set via `server.host` in the Mastra config. Now it follows the same pattern as `PORT`: config value takes precedence, then env var, then defaults to `localhost`.
