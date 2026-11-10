---
'@mastra/code-sdk': patch
---

Fixed custom OpenAI-compatible providers so they only ever authenticate with the API key saved on the provider itself.

- A custom provider is no longer given the saved credential of another provider when their names match (for example a custom provider called "OpenAI").
- A model routed through the Mastra gateway (`mastra/...`) is no longer sent to a custom provider that shares its id.
- A custom provider without an API key now works when sign-in is enabled, instead of failing with a missing credential error.
