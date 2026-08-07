---
'@mastra/factory': minor
---

Switched the default platform integrations endpoint used by `PlatformGithubIntegration` and `PlatformLinearIntegration` from `https://platform.mastra.ai/v1` to `https://integrations.mastra.ai/v1`, and added `MASTRA_PLATFORM_REGION` support. Set it to `us` or `eu` (case-insensitive) to route to the regional replica at `https://integrations.us.mastra.ai/v1` or `https://integrations.eu.mastra.ai/v1`. An explicit `MASTRA_INTEGRATIONS_API_URL` still overrides both.

```bash
# Route platform integrations to the US replica
export MASTRA_PLATFORM_REGION=us
```
