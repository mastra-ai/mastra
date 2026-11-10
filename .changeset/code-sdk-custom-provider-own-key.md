---
'@mastra/code-sdk': patch
---

Fixed custom OpenAI-compatible providers so they only ever authenticate with the API key saved on the provider itself.

- A custom provider is no longer given the saved credential of another provider when their names match (for example a custom provider called "OpenAI").
- A Mastra Gateway model (`mastra/...`) never runs on a custom provider that shares its id, with or without a gateway key.
- A custom provider without an API key now works when sign-in is enabled, instead of failing with a missing credential error.

If a custom provider in `settings.json` has no `apiKey` and relied on a key you saved for the provider it is named after (for example with `/api-keys`), set `apiKey` on the custom provider itself.
