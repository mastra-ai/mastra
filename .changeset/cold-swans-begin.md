---
'mastracode': minor
---

Added a connection test, models from the endpoint, custom headers and an auth scheme choice to `/custom-providers`. Select a provider to find them:

- **Add model** now offers the models the endpoint lists that are not added yet, one at a time or all at once, and still takes a typed ID. If the endpoint does not answer within a few seconds, it asks for the ID as before.
- **Test connection** calls the endpoint's model list and shows how many models it lists and how long it took. A failure shows the status, the URL called and the error text the endpoint returned.
- **Headers** adds or removes extra headers sent on every call. A secret value is masked while it is typed and shows as `••••`.
- **Auth scheme** sends the API key as `Authorization: Bearer <key>` or as `x-api-key: <key>`.

When an edit moves a provider's base URL to another origin, its secret headers are removed so their values are never sent to the new address. Add them again under **Headers**.

The choices are saved on the provider in `settings.json`:

```json
{
  "name": "Acme Gateway",
  "authScheme": "x-api-key",
  "headers": [{ "name": "X-Org-Id", "value": "org-123", "secret": false }]
}
```
