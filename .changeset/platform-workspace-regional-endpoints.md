---
'@mastra/platform-workspace': minor
---

Added `MASTRA_PLATFORM_REGION` support to `PlatformSandbox` and `PlatformFilesystem`. Set it to `us` or `eu` (case-insensitive) to route the workspace proxy to the regional replica at `https://workspaces.us.mastra.ai` or `https://workspaces.eu.mastra.ai`. When unset, calls continue to hit the global default `https://workspaces.mastra.ai`. An explicit `MASTRA_WORKSPACE_PROXY_URL` still overrides both.

```bash
# Route platform workspaces to the EU replica
export MASTRA_PLATFORM_REGION=eu
```
