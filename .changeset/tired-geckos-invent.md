---
'mastra': patch
---

Derive gateway and studio URLs from platform URL so staging/prod environments stay consistent. MASTRA_GATEWAY_URL and MASTRA_STUDIO_URL are now automatically set based on MASTRA_PLATFORM_API_URL, with env var overrides for each.
