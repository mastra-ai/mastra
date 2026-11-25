---
'@mastra/code-sdk': minor
---

Added an auth scheme and custom headers to custom OpenAI-compatible providers. Set `authScheme` to `x-api-key` for endpoints that read the key from an `x-api-key` header instead of `Authorization: Bearer`. Headers in `headers` are sent on every call, and the key header always wins over a custom header of the same name.

```json
{
  "customProviders": [
    {
      "name": "Acme",
      "url": "https://llm.acme.example/v1",
      "apiKey": "acme-key",
      "authScheme": "x-api-key",
      "headers": [
        { "name": "X-Org-Id", "value": "org-1", "secret": false },
        { "name": "X-Tenant-Token", "value": "tenant-token", "secret": true }
      ],
      "models": ["model-x"]
    }
  ]
}
```

Added `listCustomProviderModels` and `testCustomProviderModel` in `@mastra/code-sdk/agents/custom-provider-check`. The first lists the models an endpoint serves. The second sends one short message to a model. Both return the upstream status and error text on failure, with the key and secret header values removed.
