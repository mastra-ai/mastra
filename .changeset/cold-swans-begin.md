---
'mastracode': minor
---

Added endpoint checks, custom headers and an auth scheme choice to `/custom-providers`. Select a provider to find the new menu items:

- **Test connection** calls the endpoint's model list and shows how many models it lists and how long it took. A failure shows the status, the URL called and the error text the endpoint returned.
- **Test model** sends one short message to a configured model and shows its reply.
- **Add models from endpoint** lists the model IDs the endpoint returns that are not added yet. Add them one at a time or all at once.
- **Headers** adds or removes extra headers sent on every call. Secret values show as `••••`.
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
