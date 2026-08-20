---
'@mastra/factory': patch
---

Fixed Platform GitHub/Linear integrations and the Platform API client ignoring `MASTRA_PLATFORM_ACCESS_TOKEN`, the credential Mastra Platform injects into deployed projects. Integration auto-detection and the API client now accept `MASTRA_PLATFORM_ACCESS_TOKEN` (checked first) or `MASTRA_PLATFORM_SECRET_KEY`, so platform deployments work without manually copying the secret key into the environment.
