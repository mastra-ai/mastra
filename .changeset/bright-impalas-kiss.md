---
'@mastra/factory': minor
---

Added deployment-level custom providers to the Factory. Pass `customProviders` to `MastraFactory` (or set `MASTRACODE_CUSTOM_PROVIDERS` on the web entry) to list an OpenAI-compatible endpoint for every org as a read-only custom provider, with its models discovered from the endpoint when not listed.
