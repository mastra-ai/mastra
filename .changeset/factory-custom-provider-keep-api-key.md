---
'@mastra/factory': patch
---

Fix custom providers losing their stored API key on every edit. Saving an OpenAI-compatible provider with the API key field left blank (for example while only adding a model) kept the field's "leave blank to keep" promise on the client but still wrote `NULL` to `api_key`, so every model call through that provider failed with a 401 until the key was entered again.

`CustomProvidersStorage.upsert` now keeps the stored key when `apiKey` is omitted and only writes `NULL` for an explicit `apiKey: null`, and `POST /web/config/custom-providers` forwards a literal `null` as that deliberate clear signal.
