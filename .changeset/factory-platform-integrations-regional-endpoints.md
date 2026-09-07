---
'@mastra/factory': minor
---

Switched the default platform integrations endpoint used by `PlatformGithubIntegration` and `PlatformLinearIntegration` from `https://platform.mastra.ai/v1` to `https://integrations.mastra.ai`, and added `MASTRA_PLATFORM_REGION` support. Set it to `us` or `eu` (case-insensitive) to route to the regional replica at `https://integrations.us.mastra.ai` or `https://integrations.eu.mastra.ai`.

Endpoint resolution precedence: `MASTRA_INTEGRATIONS_API_URL` (new, integrations-specific) > `MASTRA_SHARED_API_URL` (legacy shared platform URL, still honored) > `MASTRA_PLATFORM_REGION` > global default. A trailing `/v1` on either override is stripped, so legacy values keep working unchanged.

Migration:

```bash
# Before (implicit default)
# https://platform.mastra.ai/v1

# After (implicit default)
# https://integrations.mastra.ai

# Route platform integrations to a regional replica
export MASTRA_PLATFORM_REGION=us

# Keep the previous route (e.g. pinned deployments)
export MASTRA_INTEGRATIONS_API_URL=https://platform.mastra.ai/v1
```

Deployments that already pin `MASTRA_SHARED_API_URL` need no changes.
