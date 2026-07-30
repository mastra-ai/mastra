---
'@mastra/platform-workspace': patch
---

Added automatic regional workspace proxy routing for EU and US Platform deployments while preserving explicit proxy overrides and the legacy fallback.

```bash
# Injected by Platform on managed deployments; EU deployments route to the EU proxy.
MASTRA_PLATFORM_REGION=EU npm start

# An explicit proxy URL still takes precedence over the region.
MASTRA_WORKSPACE_PROXY_URL=https://workspaces.example.com npm start
```

Runtimes without a region variable continue to use `https://workspaces.mastra.ai`.
