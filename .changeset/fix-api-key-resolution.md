---
'mastracode': patch
---

Fix API key resolution to check stored key slot and env vars.

`getAnthropicApiKey()` and `getOpenAIApiKey()` now check `authStorage.getStoredApiKey()` and `process.env` in addition to the main credential slot. Fixes API keys becoming invisible to `resolveModel` after OAuth connect/disconnect cycles.
