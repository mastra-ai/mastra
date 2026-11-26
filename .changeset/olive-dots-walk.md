---
'@mastra/factory': minor
---

Added connection checks, an auth scheme and custom headers for custom OpenAI-compatible endpoints.

**New fields on `POST /web/config/custom-providers`**

```json
{
  "name": "Team gateway",
  "url": "https://llm.example.com/v1",
  "apiKey": "sk-team",
  "authScheme": "x-api-key",
  "headers": [
    { "name": "X-Tenant", "value": "acme" },
    { "name": "X-Region", "value": "eu-west", "secret": false }
  ],
  "check": true
}
```

- `authScheme` is `bearer` (the default) or `x-api-key`.
- `headers` is the full list. A header is secret unless it is sent with `secret: false`, and secret values are never returned. On an edit, leave out `headers` to keep the saved list, or send a header without `value` to keep its saved value.
- `check: true` calls `GET {url}/models` first and saves only when the endpoint lists its models. Otherwise the response is 422 `custom_endpoint_check_failed` with the upstream `failure`, and nothing is saved.

Each provider in `GET /web/config/custom-providers` now has `authScheme`, `headers` (with values for plain headers only) and `lastCheck`. `lastCheck` is absent until a connection test has run, and an edit that changes the URL, key, auth scheme or headers without `check: true` clears it. A save with `check: true` that passes stores a fresh `lastCheck`. It records the connection test only, never a test message.

**New route `POST /web/config/custom-providers/check`**

Send the same fields as a save to test a draft without saving it, or only `previousId` to test a saved provider and record the result as its `lastCheck`. A saved organization provider also needs its scope:

```json
{ "previousId": "team-gateway", "scope": "org" }
```

Add `model` to also send one test message to that model. A failing check is returned in a 200 response, with the HTTP status and the upstream error text. A hosted Factory returns only the upstream error message or page title. Checking an organization provider needs an organization admin, like changing one.

**New error codes**

- 400 `header_refused`: a header name or value is not allowed.
- 400 `header_value_required`: a header value must be typed again. This happens for a new header, for a secret header made plain, and for a saved secret header when the URL moves to another origin.
- 409 `custom_provider_changed`: the provider was edited while a save with `check: true` was testing it. Nothing is saved, and the save can be sent again.
- 422 `custom_endpoint_check_failed`: a save with `check: true` failed its connection test.
