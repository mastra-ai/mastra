---
'@mastra/factory': minor
---

Factory now lets each user and org keep several accounts per model provider and manage them from the API.

Signing in with OAuth, or saving an API key, adds an account to the pool instead of replacing the one that is there. Signing in again to the same subscription, or saving the same key again, updates that account in place (same id, label and priority) and makes it the active account, as mastracode's AuthStorage does on login. A sign-in matches an existing account by provider identity, then by legacy account id, then by refresh token. Providers without an identity (Anthropic, GitHub Copilot) only match when the same refresh token comes back; a fresh sign-in usually issues a new one and adds another account. New accounts without a provider label are named "<Provider name> account N".

`DELETE /web/config/providers/:provider/key` now removes only an API-key account (the active one, else the first by priority) and leaves OAuth accounts in place. It returns 404 `api_key_not_found` when the pool holds no API key. Likewise, `DELETE /web/config/providers/:provider/oauth` (sign out) removes only an OAuth account (the active one, else the first by priority) and leaves API keys in place.

New routes under `/web/config/providers/:provider/accounts` list the pool and let you activate, rename, remove and reorder accounts. Every route takes `?scope=user|org` (default `user`); `org` requires an org admin. Responses contain account metadata only, never tokens or keys.

```http
GET    /web/config/providers/openai/accounts?scope=org
POST   /web/config/providers/openai/accounts/:accountId/activate
PATCH  /web/config/providers/openai/accounts/:accountId      { "label": "Work" }
DELETE /web/config/providers/openai/accounts/:accountId
PUT    /web/config/providers/openai/accounts/order           { "orderedIds": ["..."] }
```
