---
'@mastra/code-sdk': minor
---

Added an auth scheme and custom headers to custom OpenAI-compatible providers. Set `authScheme` to `x-api-key` for endpoints that read the key from an `x-api-key` header instead of `Authorization: Bearer`. Headers in `headers` are sent on every call. A header that would replace the key header (`Authorization` for `bearer`, `x-api-key` for `x-api-key`) or one the HTTP client sets, such as `Host` or `Content-Type`, is ignored.

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

Added `listCustomProviderModels`, which lists the models an endpoint serves, and `testCustomProviderModel`, which sends one short message to a model. Both are in `@mastra/code-sdk/agents/custom-provider-check` and return the upstream status and error text on failure, with the key and secret header values removed. A reply that repeats the key or a secret header value is redacted the same way.
